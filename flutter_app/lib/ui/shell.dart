// The frame around every page: top bar, the scholar-review strip, the page
// itself, the Talbiyah bar, the bottom tabs and the dialogs. Port of renderApp
// / topBar / tabBar / audioBar in src/ui/views.js.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../engine/stages.dart';
import 'app_scope.dart';
import 'screens/duas_screen.dart';
import 'screens/guided_screen.dart';
import 'screens/info_pages.dart';
import 'screens/info_screen.dart';
import 'screens/journey_screen.dart';
import 'screens/map_screen.dart';
import 'screens/modals.dart';
import 'screens/navigation.dart';
import 'screens/settings_screen.dart';
import 'theme.dart';
import 'widgets/common.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final AppNav _nav = AppNav();
  final ScrollController _scroll = ScrollController();
  bool _wasOnMap = false;
  Object? _lastPageKey;

  @override
  void initState() {
    super.initState();
    _nav.addListener(_onNav);
  }

  void _onNav() {
    // Leaving the Map tab stops its location watch (the tracker's own GPS is separate).
    if (_wasOnMap && !_nav.onMapPage) AppScope.read(context).leaveMapPage();
    _wasOnMap = _nav.onMapPage;
    setState(() {});
  }

  @override
  void dispose() {
    _nav.removeListener(_onNav);
    _nav.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Widget _page(bool chooseLanguage) {
    if (chooseLanguage) return const LanguagePage();
    final top = _nav.top;
    if (top != null) {
      return switch (top.page) {
        AppPage.prep => const PrepPage(),
        AppPage.ihram => const IhramPage(),
        AppPage.miqat => const MiqatPage(),
        AppPage.info => const InfoPage(),
        AppPage.guide => GuidePage(id: top.arg),
        AppPage.about => const AboutPage(),
        AppPage.settings => const SettingsPage(),
        AppPage.language => const LanguagePage(),
      };
    }
    return switch (_nav.currentTab) {
      tabMap => const MapPage(),
      tabDuas => const DuasPage(),
      tabJourney => const JourneyPage(),
      tabMore => const MorePage(),
      _ => const GuidedPage(),
    };
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final c = context.c;
    final chooseLanguage = !app.hasLanguage;
    final s = app.session;
    final pageKey = '${_nav.currentTab}/${_nav.top?.page}/${_nav.top?.arg}';
    if (_lastPageKey != pageKey) {
      _lastPageKey = pageKey;
      // A new page starts at the top, like following a link.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.jumpTo(0);
      });
    }
    final talbiyahBar = app.clips.talbiyahPlaying && !(_nav.top == null && _nav.currentTab == tabUmrah && s?['current_stage'] == Stage.talbiyah);
    return NavScope(
      nav: _nav,
      child: PopScope(
        canPop: !_nav.canGoBack && app.modal == null,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          if (app.modal != null) {
            app.closeModal();
          } else {
            _nav.back();
          }
        },
        child: AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light,
          child: Scaffold(
            appBar: _TopBar(nav: _nav, chooseLanguage: chooseLanguage),
            body: Stack(
              children: [
                Column(
                  children: [
                    Material(
                      color: c.warnBg,
                      child: InkWell(
                        onTap: chooseLanguage ? null : () => _nav.open(AppPage.about),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.warnLine))),
                          child: Text('⚠ ${context.t(app.content.reviewNotice)}', style: TextStyle(color: c.warnInk, fontSize: 12.5, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
                        ),
                      ),
                    ),
                    Expanded(
                      child: Scrollbar(
                        controller: _scroll,
                        child: SingleChildScrollView(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: kPageMaxWidth),
                              child: Stack14([
                                if (app.notice != null)
                                  AlertBox(
                                    kind: AlertKind.info,
                                    child: Row(children: [
                                      Expanded(child: Text(app.notice!)),
                                      IconButton(tooltip: context.t('Close'), onPressed: app.clearNotice, icon: const Icon(Icons.close, size: 18)),
                                    ]),
                                  ),
                                KeyedSubtree(key: ValueKey(pageKey), child: _page(chooseLanguage)),
                              ]),
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (talbiyahBar)
                      Material(
                        color: c.accentSoft,
                        child: SafeArea(
                          top: false,
                          bottom: chooseLanguage,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            child: Row(children: [
                              Expanded(child: Text('🔊 ${context.t('Talbiyah playing')}${app.clips.talbiyahLoop ? ' (${context.t('repeating')})' : ''}', style: const TextStyle(fontWeight: FontWeight.w600))),
                              SoftButton(label: context.t('Pause'), small: true, onPressed: app.toggleTalbiyah),
                            ]),
                          ),
                        ),
                      ),
                  ],
                ),
                const ModalLayer(),
              ],
            ),
            bottomNavigationBar: chooseLanguage
                ? null
                : NavigationBar(
                    height: 64,
                    selectedIndex: _nav.currentTab,
                    labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
                    onDestinationSelected: _nav.tab,
                    destinations: [
                      for (final t in appTabs) NavigationDestination(icon: Text(t.icon, style: const TextStyle(fontSize: 22)), label: context.t(t.label)),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget implements PreferredSizeWidget {
  const _TopBar({required this.nav, required this.chooseLanguage});
  final AppNav nav;
  final bool chooseLanguage;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final s = app.session;
    Widget chip(String label, {String? tooltip, VoidCallback? onTap, bool warn = false}) => Padding(
          padding: const EdgeInsetsDirectional.only(end: 6),
          child: Tooltip(
            message: tooltip ?? label,
            child: Material(
              color: warn ? const Color(0x33FFC107) : const Color(0x26FFFFFF),
              shape: const StadiumBorder(),
              child: InkWell(
                customBorder: const StadiumBorder(),
                onTap: onTap,
                child: Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13))),
              ),
            ),
          ),
        );
    return AppBar(
      automaticallyImplyLeading: false,
      leading: nav.canGoBack ? IconButton(tooltip: context.t('Back'), icon: const BackButtonIcon(), onPressed: nav.back) : null,
      titleSpacing: nav.canGoBack ? 0 : 16,
      title: InkWell(
        onTap: chooseLanguage ? null : () => nav.tab(tabUmrah),
        child: Text('🕋 ${context.t('Guided Umrah')}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ),
      actions: [
        if (s?['status'] == 'active' && isIhramActive(s!['current_stage'] as String)) chip('🟢 ${context.t('Ihram')}'),
        if (!chooseLanguage) chip('🌐 ${app.tr.language.native}', tooltip: context.t('Language'), onTap: () => nav.open(AppPage.language)),
        if (app.voice.available) chip(app.voice.enabled ? '🔊' : '🔇', tooltip: context.t('Voice guide'), onTap: app.toggleVoice),
        if (app.simulate) chip('🛰', tooltip: '${context.t('Simulated GPS')} — ${app.simDropped ? context.t('Restore signal') : context.t('Drop signal')}', warn: app.simDropped, onTap: app.toggleSimDrop),
        const SizedBox(width: 6),
      ],
    );
  }
}
