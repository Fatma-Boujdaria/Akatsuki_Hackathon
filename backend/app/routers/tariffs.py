"""GET /api/tariffs (any member) and PUT /api/tariffs (admin only).

PUT replaces the whole tariff configuration with the rows sent (the screen
loads everything with GET, edits, and sends everything back). The grid is
checked before saving: for each resource and date, bands must follow each
other without gaps or overlaps and only the last band may be open-ended.
"""

import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import current_household, require_admin
from app.models import Household, TariffFee, TariffTranche, User
from app.schemas import FeeRow, TariffsIO, TrancheRow
from app.services.tariff import clear_tariff_cache

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tariffs", tags=["tariffs"])


def _current(db: Session) -> TariffsIO:
    tranches = db.scalars(
        select(TariffTranche).order_by(TariffTranche.resource, TariffTranche.valid_from, TariffTranche.min_qty)
    ).all()
    fees = db.scalars(select(TariffFee).order_by(TariffFee.key, TariffFee.valid_from)).all()
    return TariffsIO(
        tranches=[TrancheRow.model_validate(t) for t in tranches],
        fees=[FeeRow.model_validate(f) for f in fees],
        pricing_mode=get_settings().tariff_pricing_mode,
    )


def validate_grid(rows: list[TrancheRow]) -> None:
    grids: dict[tuple, list[TrancheRow]] = defaultdict(list)
    for row in rows:
        grids[(row.resource, row.valid_from)].append(row)
    for (resource, valid_from), bands in grids.items():
        bands.sort(key=lambda r: r.min_qty)
        where = f"{resource} {valid_from}"
        if bands[0].min_qty != 0:
            raise HTTPException(422, f"{where}: the first band must start at 0")
        for current, following in zip(bands, bands[1:]):
            if current.max_qty is None or current.max_qty != following.min_qty:
                raise HTTPException(422, f"{where}: band ending at {current.max_qty} must end where the next starts")
        for band in bands:
            if band.max_qty is not None and band.max_qty <= band.min_qty:
                raise HTTPException(422, f"{where}: max_qty must be above min_qty")
        if bands[-1].max_qty is not None:
            raise HTTPException(422, f"{where}: the last band must have no max_qty (open-ended)")


@router.get("", response_model=TariffsIO)
def read_tariffs(_household: Household = Depends(current_household), db: Session = Depends(get_db)) -> TariffsIO:
    return _current(db)


@router.put("", response_model=TariffsIO)
def replace_tariffs(body: TariffsIO, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> TariffsIO:
    validate_grid(body.tranches)
    fee_keys = [(f.key, f.valid_from) for f in body.fees]
    if len(fee_keys) != len(set(fee_keys)):
        raise HTTPException(422, "a fee key appears twice for the same valid_from")

    db.execute(delete(TariffTranche))
    db.execute(delete(TariffFee))
    db.add_all(TariffTranche(**r.model_dump(exclude={"id"})) for r in body.tranches)
    db.add_all(TariffFee(**f.model_dump(exclude={"id"})) for f in body.fees)
    db.commit()
    clear_tariff_cache()
    log.info("tariffs replaced by %s: %d tranches, %d fees", admin.email, len(body.tranches), len(body.fees))
    return _current(db)
