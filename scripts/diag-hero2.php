<?php
require_once dirname(__FILE__) . '/wp-load.php';

$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

function dump_el($el, $depth = 0) {
  $pad = str_repeat('  ', $depth);
  $id  = $el['id'] ?? '?';
  $et  = $el['elType'] ?? '-';
  $wt  = $el['widgetType'] ?? '';
  $s   = $el['settings'] ?? [];

  $label = $wt ?: $et;
  $extra = '';
  if ($wt === 'heading') $extra = ' "' . substr($s['title'] ?? '', 0, 40) . '"';
  if ($wt === 'image')   $extra = ' src=' . substr($s['image']['url'] ?? '', -40);

  $min_h = $s['min_height'] ?? ($s['min_height_tablet'] ?? '');
  $h     = $s['height'] ?? '';
  $pad_s = json_encode($s['padding'] ?? '');
  $mar_s = json_encode($s['margin'] ?? '');
  $bg_img = isset($s['background_image']['url']) ? ' bg_img=yes' : '';
  $bg_col = isset($s['background_color']) ? ' bg=' . $s['background_color'] : '';

  echo $pad . "[$id:$label]$extra min_h=$min_h h=$h pad=$pad_s mar=$mar_s$bg_img$bg_col\n";

  if (!empty($el['elements'])) {
    foreach ($el['elements'] as $child) {
      dump_el($child, $depth + 1);
    }
  }
}

echo "<pre>\n";
foreach ($decoded as $el) {
  if ($el['id'] === 'f651997f') {
    dump_el($el);
  }
}
echo "</pre>";
@unlink(__FILE__);
