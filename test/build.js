/* build.js — produces dist/pendulum.html: one self-contained file.
   Inlines every script in load order, so the game runs from any path,
   any extractor, any device: double-click the .html, nothing else. */
'use strict';
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// only same-directory relative script tags get inlined
var missing = [];
var inlined = html.replace(/<script src="(js\/[a-z]+\.js)"><\/script>/g, function (m, src) {
  var file = path.join(root, src);
  if (!fs.existsSync(file)) { missing.push(src); return m; }
  var code = fs.readFileSync(file, 'utf8');
  if (/<\/script/i.test(code)) throw new Error('literal </script> inside ' + src);
  return '<script>\n/* ==== ' + src + ' ==== */\n' + code + '\n</script>';
});
if (missing.length) throw new Error('missing files: ' + missing.join(', '));
if (/<script src=/.test(inlined)) throw new Error('some script tags were not inlined');

var outDir = root;
var outFile = path.join(outDir, 'pendulum.html');
fs.writeFileSync(outFile, inlined);

var kb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log('built ' + path.relative(root, outFile) + '  ' + kb + ' KB  (self-contained)');
