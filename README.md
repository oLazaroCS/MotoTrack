# MotoTrack

App Flutter para uma equipe de motoboys acompanhar quem está online em um mapa real com OpenStreetMap.

## Recursos

- Mapa OpenStreetMap via `flutter_map`.
- Botão para ficar online/offline.
- GPS com alta precisão usando `geolocator`.
- Marcador circular com foto do motoboy e alfinete de localização.
- Serviço de presença em tempo real separado da interface.
- Simulação local de outros motoboys online para desenvolvimento sem backend.

## Rodar

```bash
flutter pub get
flutter run
```

## Permissões necessárias

Android:
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`, se quiser rastrear com o app em segundo plano.

iOS:
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`, se quiser segundo plano.

## Produção

O arquivo `lib/services/realtime_moto_service.dart` tem uma implementação simulada. Para produção, substitua por Firebase Realtime Database/Firestore, Supabase Realtime ou WebSocket próprio, mantendo a mesma interface.
