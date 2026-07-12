import 'package:flutter/material.dart';

import '../models/rider_location.dart';

class RiderMarker extends StatelessWidget {
  const RiderMarker({
    required this.rider,
    required this.isMe,
    super.key,
  });

  final RiderLocation rider;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final color = isMe ? const Color(0xFFE53935) : const Color(0xFF1565C0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            border: Border.all(color: color, width: 3),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Image.network(
            rider.avatarUrl,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) {
              return ColoredBox(
                color: color,
                child: Center(
                  child: Text(
                    rider.name.characters.first.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        CustomPaint(
          size: const Size(18, 14),
          painter: _PinTipPainter(color),
        ),
        Container(
          constraints: const BoxConstraints(maxWidth: 86),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(6),
            boxShadow: const [
              BoxShadow(
                color: Color(0x22000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            rider.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              height: 1.1,
            ),
          ),
        ),
      ],
    );
  }
}

class _PinTipPainter extends CustomPainter {
  const _PinTipPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _PinTipPainter oldDelegate) {
    return color != oldDelegate.color;
  }
}
