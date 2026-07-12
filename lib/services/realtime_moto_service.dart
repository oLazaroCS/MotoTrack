import 'dart:async';
import 'dart:math';

import 'package:latlong2/latlong.dart';

import '../models/rider_location.dart';

abstract class RealtimeMotoService {
  Stream<List<RiderLocation>> watchOnlineRiders();

  Future<void> setRiderOnline(RiderLocation rider);

  Future<void> updateRiderPosition({
    required String riderId,
    required LatLng position,
    double? accuracyMeters,
  });

  Future<void> setRiderOffline(String riderId);

  void dispose();
}

class DemoRealtimeMotoService implements RealtimeMotoService {
  DemoRealtimeMotoService() {
    _riders = {
      for (final rider in _initialRiders) rider.id: rider,
    };
    _controller.add(_onlineRiders);
    _timer = Timer.periodic(const Duration(seconds: 2), (_) => _moveDemoRiders());
  }

  final _controller = StreamController<List<RiderLocation>>.broadcast();
  final _random = Random();
  late final Timer _timer;
  late Map<String, RiderLocation> _riders;

  static final _initialRiders = <RiderLocation>[
    RiderLocation(
      id: 'ana',
      name: 'Ana',
      avatarUrl: 'https://i.pravatar.cc/120?img=47',
      position: const LatLng(-23.55087, -46.63382),
      isOnline: true,
      updatedAt: DateTime.now(),
      accuracyMeters: 8,
    ),
    RiderLocation(
      id: 'bruno',
      name: 'Bruno',
      avatarUrl: 'https://i.pravatar.cc/120?img=12',
      position: const LatLng(-23.55420, -46.62962),
      isOnline: true,
      updatedAt: DateTime.now(),
      accuracyMeters: 10,
    ),
    RiderLocation(
      id: 'carla',
      name: 'Carla',
      avatarUrl: 'https://i.pravatar.cc/120?img=32',
      position: const LatLng(-23.54815, -46.63864),
      isOnline: true,
      updatedAt: DateTime.now(),
      accuracyMeters: 7,
    ),
  ];

  List<RiderLocation> get _onlineRiders {
    final riders = _riders.values.where((rider) => rider.isOnline).toList();
    riders.sort((a, b) => a.name.compareTo(b.name));
    return riders;
  }

  @override
  Stream<List<RiderLocation>> watchOnlineRiders() => _controller.stream;

  @override
  Future<void> setRiderOnline(RiderLocation rider) async {
    _riders[rider.id] = rider.copyWith(isOnline: true, updatedAt: DateTime.now());
    _controller.add(_onlineRiders);
  }

  @override
  Future<void> updateRiderPosition({
    required String riderId,
    required LatLng position,
    double? accuracyMeters,
  }) async {
    final rider = _riders[riderId];
    if (rider == null || !rider.isOnline) {
      return;
    }

    _riders[riderId] = rider.copyWith(
      position: position,
      accuracyMeters: accuracyMeters,
      updatedAt: DateTime.now(),
    );
    _controller.add(_onlineRiders);
  }

  @override
  Future<void> setRiderOffline(String riderId) async {
    final rider = _riders[riderId];
    if (rider == null) {
      return;
    }

    _riders[riderId] = rider.copyWith(isOnline: false, updatedAt: DateTime.now());
    _controller.add(_onlineRiders);
  }

  void _moveDemoRiders() {
    _riders.updateAll((id, rider) {
      if (id == 'me' || !rider.isOnline) {
        return rider;
      }

      final latOffset = (_random.nextDouble() - 0.5) / 6000;
      final lngOffset = (_random.nextDouble() - 0.5) / 6000;
      return rider.copyWith(
        position: LatLng(
          rider.position.latitude + latOffset,
          rider.position.longitude + lngOffset,
        ),
        updatedAt: DateTime.now(),
      );
    });
    _controller.add(_onlineRiders);
  }

  @override
  void dispose() {
    _timer.cancel();
    _controller.close();
  }
}
