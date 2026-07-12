import 'package:flutter/material.dart';

import 'screens/moto_map_screen.dart';

void main() {
  runApp(const MotoTrackApp());
}

class MotoTrackApp extends StatelessWidget {
  const MotoTrackApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MotoTrack',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE53935),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const MotoMapScreen(),
    );
  }
}
