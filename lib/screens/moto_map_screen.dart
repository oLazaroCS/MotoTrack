import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../models/rider_location.dart';
import '../services/location_service.dart';
import '../services/realtime_moto_service.dart';
import '../widgets/rider_marker.dart';

class MotoMapScreen extends StatefulWidget {
  const MotoMapScreen({super.key});

  @override
  State<MotoMapScreen> createState() => _MotoMapScreenState();
}

class _MotoMapScreenState extends State<MotoMapScreen> {
  static const _meId = 'me';
  static const _fallbackCenter = LatLng(-23.55052, -46.63331);

  final _mapController = MapController();
  final _locationService = LocationService();
  final _realtimeService = DemoRealtimeMotoService();

  StreamSubscription? _gpsSubscription;
  StreamSubscription<List<RiderLocation>>? _ridersSubscription;

  List<RiderLocation> _riders = [];
  bool _isOnline = false;
  bool _isLoadingLocation = false;
  String? _statusMessage;
  LatLng _mapCenter = _fallbackCenter;

  @override
  void initState() {
    super.initState();
    _ridersSubscription = _realtimeService.watchOnlineRiders().listen((riders) {
      if (!mounted) {
        return;
      }
      setState(() => _riders = riders);
    });
    _centerOnCurrentPosition();
  }

  @override
  void dispose() {
    _gpsSubscription?.cancel();
    _ridersSubscription?.cancel();
    _realtimeService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final onlineCount = _riders.length;

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _mapCenter,
              initialZoom: 15,
              minZoom: 3,
              maxZoom: 19,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.mototrack.app',
                maxZoom: 19,
              ),
              MarkerLayer(
                markers: _riders.map(_buildMarker).toList(),
              ),
            ],
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Header(
                    onlineCount: onlineCount,
                    isOnline: _isOnline,
                    statusMessage: _statusMessage,
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _isLoadingLocation ? null : _toggleOnline,
                          icon: Icon(_isOnline ? Icons.power_settings_new : Icons.gps_fixed),
                          label: Text(_isOnline ? 'Ficar offline' : 'Ficar online'),
                          style: FilledButton.styleFrom(
                            backgroundColor: _isOnline
                                ? const Color(0xFF263238)
                                : const Color(0xFFE53935),
                            minimumSize: const Size.fromHeight(54),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      IconButton.filled(
                        onPressed: _centerOnCurrentPosition,
                        tooltip: 'Centralizar no GPS',
                        icon: const Icon(Icons.my_location),
                        style: IconButton.styleFrom(
                          minimumSize: const Size(54, 54),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Marker _buildMarker(RiderLocation rider) {
    return Marker(
      point: rider.position,
      width: 96,
      height: 92,
      alignment: Alignment.topCenter,
      child: RiderMarker(
        rider: rider,
        isMe: rider.id == _meId,
      ),
    );
  }

  Future<void> _toggleOnline() async {
    if (_isOnline) {
      await _goOffline();
      return;
    }

    await _goOnline();
  }

  Future<void> _goOnline() async {
    setState(() {
      _isLoadingLocation = true;
      _statusMessage = 'Ativando GPS...';
    });

    final allowed = await _locationService.ensurePermission();
    if (!allowed) {
      setState(() {
        _isLoadingLocation = false;
        _statusMessage = 'Permita a localização para ficar online.';
      });
      return;
    }

    final current = await _locationService.currentPosition() ?? _mapCenter;
    final me = RiderLocation(
      id: _meId,
      name: 'Você',
      avatarUrl: 'https://i.pravatar.cc/120?img=3',
      position: current,
      isOnline: true,
      updatedAt: DateTime.now(),
      accuracyMeters: 5,
    );

    await _realtimeService.setRiderOnline(me);
    _mapController.move(current, 16);

    _gpsSubscription?.cancel();
    _gpsSubscription = _locationService.watchPrecisePosition().listen((position) {
      final latLng = LatLng(position.latitude, position.longitude);
      _mapCenter = latLng;
      _realtimeService.updateRiderPosition(
        riderId: _meId,
        position: latLng,
        accuracyMeters: position.accuracy,
      );
    });

    setState(() {
      _isOnline = true;
      _isLoadingLocation = false;
      _statusMessage = 'Online e compartilhando localização.';
      _mapCenter = current;
    });
  }

  Future<void> _goOffline() async {
    await _gpsSubscription?.cancel();
    _gpsSubscription = null;
    await _realtimeService.setRiderOffline(_meId);

    setState(() {
      _isOnline = false;
      _statusMessage = 'Offline. Sua localização não está sendo enviada.';
    });
  }

  Future<void> _centerOnCurrentPosition() async {
    final current = await _locationService.currentPosition();
    if (!mounted || current == null) {
      return;
    }

    setState(() => _mapCenter = current);
    _mapController.move(current, 15.5);
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.onlineCount,
    required this.isOnline,
    required this.statusMessage,
  });

  final int onlineCount;
  final bool isOnline;
  final String? statusMessage;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 12,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: isOnline ? const Color(0xFF2E7D32) : const Color(0xFF78909C),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                isOnline ? Icons.delivery_dining : Icons.location_off,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$onlineCount motoboys online',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  Text(
                    statusMessage ?? 'Mapa em tempo real da equipe',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
