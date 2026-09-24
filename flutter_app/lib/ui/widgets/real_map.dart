// A real, live world map (OpenStreetMap) for when the pilgrim is too far from
// Masjid al-Haram for the offline Haram diagram to mean anything — while
// testing at home, for instance. Needs internet to load map tiles; nothing
// here is cached for offline use, unlike every other part of the app.
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../engine/geo.dart';
import '../app_scope.dart';
import '../theme.dart';
import 'common.dart';

// OpenStreetMap's tiles are drawn for a light background: invert (and dim)
// them in dark mode so a pilgrim checking this at night isn't hit with a
// bright white map. The marker lives in its own layer and is untouched.
const ColorFilter _darkTiles = ColorFilter.matrix(<double>[
  -0.65, 0, 0, 0, 215, //
  0, -0.65, 0, 0, 215,
  0, 0, -0.65, 0, 220,
  0, 0, 0, 1, 0,
]);

class RealMap extends StatefulWidget {
  const RealMap({super.key, required this.point, this.accuracyM, this.height = 320});
  final GeoPoint? point;
  final double? accuracyM;
  final double height;

  @override
  State<RealMap> createState() => _RealMapState();
}

class _RealMapState extends State<RealMap> {
  final MapController _controller = MapController();
  bool _centered = false;
  bool _tilesFailed = false;
  bool _ready = false;

  @override
  void didUpdateWidget(RealMap old) {
    super.didUpdateWidget(old);
    _centerOnce();
  }

  // The first fix zooms in to the pilgrim; after that the marker just moves,
  // so a pilgrim who has zoomed or panned is not fought.
  void _centerOnce() {
    final p = widget.point;
    if (p == null || _centered || !_ready) return;
    _centered = true;
    _controller.move(LatLng(p.lat, p.lng), 16);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final p = widget.point;
    final here = p == null ? null : LatLng(p.lat, p.lng);
    return Semantics(
      label: context.t('Real map showing your current location'),
      image: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kRadius),
        child: SizedBox(
          height: widget.height,
          child: Stack(
            children: [
              FlutterMap(
                mapController: _controller,
                options: MapOptions(
                  initialCenter: here ?? const LatLng(21.4225, 39.8262),
                  initialZoom: here == null ? 4 : 16,
                  minZoom: 2,
                  maxZoom: 18,
                  onMapReady: () {
                    _ready = true;
                    _centered = here != null;
                  },
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.guidedumrah.app',
                    maxNativeZoom: 19,
                    tileBuilder: dark ? (context, tile, _) => ColorFiltered(colorFilter: _darkTiles, child: tile) : null,
                    errorTileCallback: (tile, error, stack) {
                      if (!_tilesFailed && mounted) setState(() => _tilesFailed = true);
                    },
                  ),
                  if (here != null && widget.accuracyM != null && widget.accuracyM! > 0)
                    CircleLayer(circles: [CircleMarker(point: here, radius: widget.accuracyM!, useRadiusInMeter: true, color: const Color(0xFF2F6FED).withValues(alpha: 0.10), borderColor: const Color(0xFF2F6FED), borderStrokeWidth: 1)]),
                  if (here != null)
                    MarkerLayer(markers: [
                      Marker(
                        point: here,
                        width: 22,
                        height: 22,
                        child: Container(decoration: BoxDecoration(color: c.gold, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2.5))),
                      ),
                    ]),
                  const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap contributors')]),
                ],
              ),
              if (_tilesFailed)
                Positioned(
                  left: 8,
                  right: 8,
                  top: 8,
                  child: AlertBox(kind: AlertKind.warn, child: Text(context.t('Could not load the real map — you appear to be offline.'))),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
