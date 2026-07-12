import 'package:flutter_test/flutter_test.dart';
import 'package:mototrack/main.dart';

void main() {
  testWidgets('renders MotoTrack app', (tester) async {
    await tester.pumpWidget(const MotoTrackApp());
    await tester.pump();

    expect(find.text('Mapa em tempo real da equipe'), findsOneWidget);
  });
}
