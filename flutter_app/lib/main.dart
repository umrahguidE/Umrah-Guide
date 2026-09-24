// Guided Umrah — an offline-first companion that follows one pilgrim from
// preparation to the completion of Umrah.
//
//   lib/engine/    pure Dart ritual rules (state machine, geometry, trackers)
//   lib/app/       content, translations, storage and the app controller
//   lib/services/  device features: GPS/sensors, voice guide, recitations
//   lib/ui/        theme, painters, shared widgets, screens and the shell
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show SemanticsBinding;
import 'package:intl/date_symbol_data_local.dart';

import 'app/app_controller.dart';
import 'app/content.dart';
import 'app/i18n.dart';
import 'app/store.dart';
import 'ui/app_scope.dart';
import 'ui/shell.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting();
  final content = await Content.load();
  final store = await Store.open();
  // The web build in simulator mode is what the automated UI checks drive, and
  // they find buttons through the accessibility tree.
  if (kIsWeb && simulateFromEnvironment) SemanticsBinding.instance.ensureSemantics();
  final controller = AppController(content: content, store: store, tr: Translator(content.languages), simulate: simulateFromEnvironment);
  await controller.init();
  runApp(GuidedUmrahApp(controller: controller));
}

class GuidedUmrahApp extends StatelessWidget {
  const GuidedUmrahApp({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      controller: controller,
      child: Builder(builder: (context) {
        final app = context.app;
        return MaterialApp(
          title: 'Guided Umrah',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          // Right-to-left for Urdu, and the pilgrim's chosen text size on top
          // of the phone's own setting.
          builder: (context, child) {
            final mq = MediaQuery.of(context);
            final scale = app.prefs.textScale;
            return Directionality(
              textDirection: app.tr.language.rtl ? TextDirection.rtl : TextDirection.ltr,
              child: MediaQuery(
                data: mq.copyWith(textScaler: scale == 1 ? mq.textScaler : TextScaler.linear(mq.textScaler.scale(1) * scale)),
                child: child!,
              ),
            );
          },
          home: const AppShell(),
        );
      }),
    );
  }
}
