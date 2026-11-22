import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../util/i18n.dart';
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message, {this.code});

  /// HTTP status, 0 when the server could not be reached.
  final int status;
  final String message;

  /// Machine code from the API, e.g. "email_not_verified".
  final String? code;
  @override
  String toString() => message;
}

/// Client for the Cartheco FastAPI backend (same calls as frontend/src/lib/api.ts).
class Api {
  Api({required this.baseUrl, this.token, this.householdId, this.onUnauthorized, http.Client? client})
      : _client = client ?? http.Client();

  String baseUrl;
  String? token;

  /// The home every household endpoint works on (sent as X-Household-Id).
  String? householdId;
  void Function()? onUnauthorized;

  /// Called when the chosen home no longer exists (deleted elsewhere).
  void Function()? onHouseholdGone;
  final http.Client _client;
  static const _timeout = Duration(seconds: 15);

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = Uri.parse(baseUrl.replaceFirst(RegExp(r'/+$'), ''));
    return base.replace(path: '${base.path}$path', queryParameters: query);
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
      if (householdId != null) headers['X-Household-Id'] = householdId!;
    }

    final http.Response res;
    try {
      final req = http.Request(method, _uri(path, query))..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await _client.send(req).timeout(_timeout));
    } on TimeoutException {
      throw ApiException(0, L('Le serveur ne répond pas ($baseUrl).', 'The server does not answer ($baseUrl).',
          'السرفور ما يجاوبش ($baseUrl).'));
    } on FormatException {
      throw ApiException(0, L('Adresse du serveur invalide : $baseUrl', 'Invalid server address: $baseUrl',
          'عنوان السرفور غالط: $baseUrl'));
    } catch (_) {
      throw ApiException(
          0,
          L('Serveur injoignable ($baseUrl). Vérifie l\'adresse et le Wi-Fi.',
              'Server unreachable ($baseUrl). Check the address and the Wi-Fi.',
              'ما نجمش نوصل للسرفور ($baseUrl). ثبّت في العنوان والواي فاي.'));
    }

    final text = utf8.decode(res.bodyBytes);
    dynamic data;
    try {
      data = text.isEmpty ? null : jsonDecode(text);
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 400) {
      if (res.statusCode == 401 && token != null && !path.startsWith('/api/auth/login')) {
        token = null;
        onUnauthorized?.call();
      }
      final message = errorMessage(res.statusCode, data);
      // The chosen home was deleted: fall back to the first one on the next call.
      if (res.statusCode == 404 && headers.containsKey('X-Household-Id') && message == 'Foyer introuvable') {
        householdId = null;
        onHouseholdGone?.call();
      }
      throw ApiException(res.statusCode, message, code: _errorCode(data));
    }
    return data;
  }

  static String? _errorCode(dynamic data) {
    final detail = data is Map ? data['detail'] : null;
    return detail is Map && detail['code'] != null ? '${detail['code']}' : null;
  }

  /// FastAPI errors: {detail: "text"} or {detail: [{loc, msg}]} (422) or {detail: {message}}.
  static String errorMessage(int status, dynamic data) {
    final detail = data is Map ? data['detail'] : null;
    if (detail is String) return detail;
    if (detail is List && detail.isNotEmpty) {
      return detail.map((d) {
        final loc = (d is Map && d['loc'] is List) ? (d['loc'] as List).where((p) => p != 'body').join('.') : '';
        final msg = d is Map ? (d['msg'] ?? '') : '$d';
        return loc.isEmpty ? '$msg' : '$loc : $msg';
      }).join(' · ');
    }
    if (detail is Map && detail['message'] != null) return '${detail['message']}';
    if (status >= 500) {
      return L('Erreur du serveur. Réessaie dans un instant.', 'Server error. Try again in a moment.',
          'مشكل في السرفور. عاود بعد شوية.');
    }
    return L('Erreur $status', 'Error $status', 'غلطة $status');
  }

  List<T> _listOf<T>(dynamic l, T Function(Json) f) => [for (final e in (l as List)) f(e as Json)];

  // ---- Accounts ---------------------------------------------------------------------

  Future<(String, User)> login(String email, String password, {bool remember = true}) async {
    final j = await _send('POST', '/api/auth/login', body: {'email': email, 'password': password, 'remember': remember}) as Json;
    return (j['access_token'] as String, User.fromJson(j['user']));
  }

  Future<CodeSent> register({required String fullName, required String email, required String password, required String language}) async =>
      CodeSent(await _send('POST', '/api/auth/register',
          body: {'full_name': fullName, 'email': email, 'password': password, 'language': language}));

  Future<(String, User)> verifyEmail(String email, String code) async {
    final j = await _send('POST', '/api/auth/verify-email', body: {'email': email, 'code': code}) as Json;
    return (j['access_token'] as String, User.fromJson(j['user']));
  }

  Future<CodeSent> resendCode(String email) async => CodeSent(await _send('POST', '/api/auth/resend-code', body: {'email': email}));
  Future<CodeSent> forgotPassword(String email) async =>
      CodeSent(await _send('POST', '/api/auth/forgot-password', body: {'email': email}));
  Future<void> resetPassword(String email, String code, String newPassword) =>
      _send('POST', '/api/auth/reset-password', body: {'email': email, 'code': code, 'new_password': newPassword});

  Future<User> me() async => User.fromJson(await _send('GET', '/api/auth/me'));
  Future<User> updateMe({String? fullName, String? language, NotifyPrefs? notifyPrefs}) async => User.fromJson(await _send(
        'PATCH',
        '/api/auth/me',
        body: {'full_name': ?fullName, 'language': ?language, 'notify_prefs': ?notifyPrefs?.toJson()},
      ));

  /// Returns a new token: the other sessions are logged out.
  Future<String> changePassword(String current, String next) async {
    final j = await _send('POST', '/api/auth/change-password', body: {'current_password': current, 'new_password': next}) as Json;
    return j['access_token'] as String;
  }

  Future<void> logoutAll() => _send('POST', '/api/auth/logout-all');
  Future<void> deleteAccount(String password, String confirm) =>
      _send('DELETE', '/api/auth/me', body: {'password': password, 'confirm': confirm});

  // ---- Homes ------------------------------------------------------------------------

  Future<List<Household>> households() async => _listOf(await _send('GET', '/api/households'), Household.fromJson);
  Future<Household> createHousehold(HouseholdIn h) async =>
      Household.fromJson(await _send('POST', '/api/households', body: h.toJson()));
  Future<Household> updateHousehold(String id, HouseholdIn h) async =>
      Household.fromJson(await _send('PUT', '/api/households/$id', body: h.toJson()));
  Future<void> deleteHousehold(String id) => _send('DELETE', '/api/households/$id');
  Future<DeviceCreated> addDevice(String householdId, String kind) async =>
      DeviceCreated(await _send('POST', '/api/households/$householdId/devices', body: {'kind': kind}));

  // ---- Appliances -------------------------------------------------------------------

  Future<List<ApplianceCatalogItem>> applianceCatalog() async =>
      _listOf(await _send('GET', '/api/appliances/catalog'), ApplianceCatalogItem.new);
  Future<List<Appliance>> appliances() async => _listOf(await _send('GET', '/api/appliances'), Appliance.new);
  Future<Appliance> addAppliance(ApplianceIn a) async => Appliance(await _send('POST', '/api/appliances', body: a.toJson()));
  Future<Appliance> updateAppliance(String id, ApplianceIn a) async =>
      Appliance(await _send('PUT', '/api/appliances/$id', body: a.toJson()));
  Future<void> deleteAppliance(String id) => _send('DELETE', '/api/appliances/$id');

  /// Replaces the whole appliance profile (onboarding), and ends the onboarding.
  Future<List<Appliance>> replaceAppliances(List<ApplianceIn> items, {bool finishOnboarding = true}) async => _listOf(
      await _send('POST', '/api/appliances/bulk',
          body: {'items': [for (final i in items) i.toJson()], 'finish_onboarding': finishOnboarding}),
      Appliance.new);

  // ---- Insights, history, assistant -------------------------------------------------

  Future<Insights> insights() async => Insights(await _send('GET', '/api/insights'));
  Future<History> history({int months = 12}) async =>
      History(await _send('GET', '/api/history', query: {'months': '$months'}));
  Future<ChatOut> chat(String message, String language, List<ChatTurn> history) async => ChatOut(await _send(
        'POST',
        '/api/assistant/chat',
        body: {'message': message, 'language': language, 'history': [for (final t in history) t.toJson()]},
      ));

  // ---- Notifications and support ----------------------------------------------------

  Future<List<AppNotification>> notifications({String status = 'all', String type = 'all'}) async => _listOf(
      await _send('GET', '/api/notifications', query: {'status': status, 'type': type, 'limit': '200'}),
      AppNotification.fromJson);
  Future<void> readNotification(String id) => _send('POST', '/api/notifications/$id/read');
  Future<int> readAll({String? householdId}) async {
    final j = await _send('POST', '/api/notifications/read-all', query: {'household_id': ?householdId}) as Json?;
    return (j?['updated'] as num?)?.toInt() ?? 0;
  }

  Future<Ticket> createTicket({required String category, required String subject, required String message}) async =>
      Ticket(await _send('POST', '/api/support/tickets', body: {'category': category, 'subject': subject, 'message': message}));
  Future<List<Ticket>> myTickets() async => _listOf(await _send('GET', '/api/support/tickets'), Ticket.new);

  // ---- Dashboard and data of the chosen home ----------------------------------------

  Future<Dashboard> dashboard() async => Dashboard.fromJson(await _send('GET', '/api/dashboard'));

  Future<Series> readings(String resource, {String? from, String? to, String? bucket}) async {
    final q = {'resource': resource, 'from': ?from, 'to': ?to, 'bucket': ?bucket};
    return Series.fromJson(await _send('GET', '/api/readings', query: q));
  }

  Future<List<Alert>> alerts({String status = 'all'}) async {
    final l = await _send('GET', '/api/alerts', query: {'status': status, 'limit': '100'}) as List;
    return [for (final a in l) Alert.fromJson(a as Json)];
  }

  Future<void> ackAlert(String id) => _send('POST', '/api/alerts/$id/ack');

  Future<List<Tip>> tips() async {
    final l = await _send('GET', '/api/tips') as List;
    return [for (final t in l) Tip.fromJson(t as Json)];
  }

  Future<Score> score() async => Score(await _send('GET', '/api/score') as Json);
  Future<Settings> settings() async => Settings.fromJson(await _send('GET', '/api/settings'));
  Future<Settings> updateSettings(Json body) async => Settings.fromJson(await _send('PUT', '/api/settings', body: body));
  Future<Tariffs> tariffs() async => Tariffs(await _send('GET', '/api/tariffs') as Json);
  Future<SpikeOut> spike() async => SpikeOut(await _send('POST', '/api/demo/spike', body: <String, dynamic>{}) as Json);
  Future<void> health() => _send('GET', '/api/health');
}
