import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);

  /// HTTP status, 0 when the server could not be reached.
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// Client for the Tranche Guard FastAPI backend.
class Api {
  Api({required this.baseUrl, this.token, this.onUnauthorized});

  String baseUrl;
  String? token;
  void Function()? onUnauthorized;
  final http.Client _client = http.Client();
  static const _timeout = Duration(seconds: 12);

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = Uri.parse(baseUrl.replaceFirst(RegExp(r'/+$'), ''));
    return base.replace(path: '${base.path}$path', queryParameters: query);
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token != null) headers['Authorization'] = 'Bearer $token';

    final http.Response res;
    try {
      final req = http.Request(method, _uri(path, query))..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await _client.send(req).timeout(_timeout));
    } on TimeoutException {
      throw ApiException(0, 'Le serveur ne répond pas ($baseUrl).');
    } on FormatException {
      throw ApiException(0, 'Adresse du serveur invalide : $baseUrl');
    } catch (_) {
      throw ApiException(0, 'Serveur injoignable ($baseUrl). Vérifie l\'adresse et le Wi-Fi.');
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
      throw ApiException(res.statusCode, _errorMessage(res.statusCode, data));
    }
    return data;
  }

  /// FastAPI errors: {detail: "text"} or {detail: [{loc, msg}]} (422) or {detail: {message}}.
  static String _errorMessage(int status, dynamic data) {
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
    if (status >= 500) return 'Erreur du serveur. Réessaie dans un instant.';
    return 'Erreur $status';
  }

  Future<(String, User)> login(String email, String password) async {
    final j = await _send('POST', '/api/auth/login', body: {'email': email, 'password': password}) as Json;
    return (j['access_token'] as String, User.fromJson(j['user']));
  }

  Future<User> me() async => User.fromJson(await _send('GET', '/api/auth/me'));
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
  Future<Settings> updateSettings(Json body) async =>
      Settings.fromJson(await _send('PUT', '/api/settings', body: body));
  Future<Tariffs> tariffs() async => Tariffs(await _send('GET', '/api/tariffs') as Json);
  Future<SpikeOut> spike() async => SpikeOut(await _send('POST', '/api/demo/spike', body: <String, dynamic>{}) as Json);
  Future<void> health() => _send('GET', '/api/health');
}
