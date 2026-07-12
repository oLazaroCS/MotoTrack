import 'package:latlong2/latlong.dart';

class RiderLocation {
  const RiderLocation({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.position,
    required this.isOnline,
    required this.updatedAt,
    this.accuracyMeters,
  });

  final String id;
  final String name;
  final String avatarUrl;
  final LatLng position;
  final bool isOnline;
  final DateTime updatedAt;
  final double? accuracyMeters;

  RiderLocation copyWith({
    String? id,
    String? name,
    String? avatarUrl,
    LatLng? position,
    bool? isOnline,
    DateTime? updatedAt,
    double? accuracyMeters,
  }) {
    return RiderLocation(
      id: id ?? this.id,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      position: position ?? this.position,
      isOnline: isOnline ?? this.isOnline,
      updatedAt: updatedAt ?? this.updatedAt,
      accuracyMeters: accuracyMeters ?? this.accuracyMeters,
    );
  }
}
