// Where the pilgrim is in the app: one of the five bottom tabs, plus an
// optional stack of pages opened on top of it (Preparation, Settings, ...).
// The web app does this with URL hashes; here it is a small notifier so the
// Android back button and the top-bar "back" arrow can pop one page at a time.
import 'package:flutter/widgets.dart';

enum AppPage { prep, ihram, miqat, info, guide, about, settings, language }

/// The bottom tabs, in order.
const List<({String icon, String label})> appTabs = [
  (icon: '🕋', label: 'Umrah'),
  (icon: '🗺', label: 'Map'),
  (icon: '🤲', label: 'Duas'),
  (icon: '🧭', label: 'Journey'),
  (icon: '☰', label: 'More'),
];

const int tabUmrah = 0;
const int tabMap = 1;
const int tabDuas = 2;
const int tabJourney = 3;
const int tabMore = 4;

class NavRoute {
  const NavRoute(this.page, [this.arg]);
  final AppPage page;

  /// Which guide ('makkah' / 'madinah') for [AppPage.guide].
  final String? arg;
}

class AppNav extends ChangeNotifier {
  int _tab = tabUmrah;
  final List<NavRoute> _stack = [];

  int get currentTab => _tab;
  NavRoute? get top => _stack.isEmpty ? null : _stack.last;
  bool get canGoBack => _stack.isNotEmpty;

  /// True while the standalone Map page is what the pilgrim is looking at.
  bool get onMapPage => _stack.isEmpty && _tab == tabMap;

  void tab(int index) {
    if (index == _tab && _stack.isEmpty) return;
    _tab = index;
    _stack.clear();
    notifyListeners();
  }

  void open(AppPage page, [String? arg]) {
    _stack.add(NavRoute(page, arg));
    notifyListeners();
  }

  /// Pops the top page. Returns false when there was nothing to pop.
  bool back() {
    if (_stack.isEmpty) return false;
    _stack.removeLast();
    notifyListeners();
    return true;
  }
}

class NavScope extends InheritedNotifier<AppNav> {
  const NavScope({super.key, required AppNav nav, required super.child}) : super(notifier: nav);

  /// The navigator, without rebuilding the caller when it changes.
  static AppNav read(BuildContext context) => context.getInheritedWidgetOfExactType<NavScope>()!.notifier!;
}

extension NavX on BuildContext {
  AppNav get nav => NavScope.read(this);
}
