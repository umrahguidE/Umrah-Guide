// Makes the controller available to every widget and rebuilds whichever ones
// read it whenever it changes.
import 'package:flutter/widgets.dart';

import '../app/app_controller.dart';

class AppScope extends InheritedNotifier<AppController> {
  const AppScope({super.key, required AppController controller, required super.child}) : super(notifier: controller);

  static AppController of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  /// Reads the controller without rebuilding when it changes (for callbacks).
  static AppController read(BuildContext context) => (context.getInheritedWidgetOfExactType<AppScope>()!).notifier!;
}

extension AppScopeX on BuildContext {
  /// The app controller; the calling widget rebuilds when it changes.
  AppController get app => AppScope.of(this);

  /// Shorthand for translating an English source string.
  String t(String text, [Map<String, Object?>? vars]) => AppScope.of(this).t(text, vars);
}
