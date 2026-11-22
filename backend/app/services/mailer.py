"""Emails: verification codes and password reset.

With SMTP_HOST set, the email is sent through that server. Without it (local
demo), the email is written to the server log instead, and the routers may
return the code on screen when DEMO_MODE is on (settings.show_dev_codes).
Never raises: a failed email is logged and counted, the request still answers.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app import monitor
from app.config import get_settings

log = logging.getLogger(__name__)

SUBJECTS = {
    "verify_email": {
        "fr": "Ton code Tranche Guard",
        "en": "Your Tranche Guard code",
        "ar": "الكود متاعك في Tranche Guard",
    },
    "reset_password": {
        "fr": "Réinitialise ton mot de passe Tranche Guard",
        "en": "Reset your Tranche Guard password",
        "ar": "بدّل كلمة السر متاعك في Tranche Guard",
    },
}

BODIES = {
    "verify_email": {
        "fr": "Bonjour {name},\n\nTon code de vérification est : {code}\nIl est valable {minutes} minutes.\n\n"
        "Si tu n'as pas créé de compte, ignore cet email.\n\nTranche Guard",
        "en": "Hello {name},\n\nYour verification code is: {code}\nIt is valid for {minutes} minutes.\n\n"
        "If you did not create an account, ignore this email.\n\nTranche Guard",
        "ar": "عسلامة {name}،\n\nالكود متاعك هو: {code}\nصالح لمدة {minutes} دقيقة.\n\n"
        "كان ما عملتش حساب، ما تعمل شي.\n\nTranche Guard",
    },
    "reset_password": {
        "fr": "Bonjour {name},\n\nTon code pour choisir un nouveau mot de passe : {code}\n"
        "Il est valable {minutes} minutes.\n\nSi tu n'as rien demandé, ignore cet email : "
        "ton mot de passe ne change pas.\n\nTranche Guard",
        "en": "Hello {name},\n\nYour code to choose a new password: {code}\nIt is valid for {minutes} minutes.\n\n"
        "If you did not ask for it, ignore this email: your password stays the same.\n\nTranche Guard",
        "ar": "عسلامة {name}،\n\nالكود باش تختار كلمة سر جديدة: {code}\nصالح لمدة {minutes} دقيقة.\n\n"
        "كان ما طلبت شي، ما تعمل شي: كلمة السر متاعك ما تتبدّلش.\n\nTranche Guard",
    },
}


def send_code_email(to: str, name: str | None, purpose: str, code: str, language: str = "fr") -> bool:
    """Send (or log) the code email. Returns True if it was handed to the SMTP server."""
    settings = get_settings()
    lang = language if language in ("fr", "en", "ar") else "fr"
    subject = SUBJECTS[purpose][lang]
    body = BODIES[purpose][lang].format(name=name or to, code=code, minutes=settings.email_code_minutes)

    if not settings.email_configured:
        # No mail server. In the local demo the code goes to the log; otherwise it is dropped.
        if settings.demo_mode:
            log.info("EMAIL (not sent, no SMTP_HOST) to=%s subject=%r code=%s", to, subject, code)
        else:
            log.warning("EMAIL to %s not sent: SMTP_HOST is not configured", to)
        monitor.incr("emails_logged")
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        log.warning("email to %s failed: %s", to, type(exc).__name__)
        monitor.incr("emails_failed")
        monitor.error(f"email failed: {type(exc).__name__}")
        return False
    monitor.incr("emails_sent")
    return True
