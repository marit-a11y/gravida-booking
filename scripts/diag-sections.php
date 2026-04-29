<?php
require_once dirname(__FILE__) . '/wp-load.php';

$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

echo "<pre>\n";
// Print top-level sections with their margin/padding
foreach ($decoded as $el) {
  $id = $el['id'] ?? '?';
  $et = $el['elType'] ?? '-';
  $s  = $el['settings'] ?? [];

  // Find dominant content to identify section
  $label = '';
  if (!empty($el['elements'])) {
    foreach ($el['elements'] as $child) {
      if (!empty($child['elements'])) {
        foreach ($child['elements'] as $gc) {
          $wt = $gc['widgetType'] ?? '';
          if ($wt === 'heading') { $label = substr($gc['settings']['title'] ?? '', 0, 40); break 2; }
          if ($wt === 'html')    { $label = '[IFRAME]'; break 2; }
          if ($wt === 'image')   { $label = '[IMAGE]';  break 2; }
        }
      }
      $wt = $child['widgetType'] ?? '';
      if ($wt === 'heading') { $label = substr($child['settings']['title'] ?? '', 0, 40); break; }
      if ($wt === 'html')    { $label = '[IFRAME]'; break; }
    }
  }

  $margin  = json_encode($s['margin']  ?? 'niet ingesteld');
  $padding = json_encode($s['padding'] ?? 'niet ingesteld');
  $bg      = $s['background_color'] ?? ($s['background_image']['url'] ?? '');

  echo "[$id:$et] \"$label\"\n";
  echo "  margin:  $margin\n";
  echo "  padding: $padding\n";
  if ($bg) echo "  bg: " . substr($bg, 0, 60) . "\n";
  echo "\n";
}
echo "</pre>";
@unlink(__FILE__);
