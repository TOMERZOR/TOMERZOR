// Premiere Pro side of the Kafitz panel (ExtendScript, ES3: no let/const, no arrow functions, no JSON).
// Every function returns a JSON string: {"ok":true,"data":...} or {"ok":false,"error":"..."}.
var kafitz = (function () {
  var TICKS = 254016000000;

  function quote(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
  }
  function ser(v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return quote(v);
    var i, a = [];
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) a.push(ser(v[i]));
      return '[' + a.join(',') + ']';
    }
    for (var k in v) if (v.hasOwnProperty(k)) a.push(quote(k) + ':' + ser(v[k]));
    return '{' + a.join(',') + '}';
  }
  function ok(data) { return ser({ ok: true, data: data }); }
  function fail(msg) { return ser({ ok: false, error: String(msg) }); }

  function seq() { return app.project.activeSequence; }
  function fps(s) { return TICKS / Number(s.timebase); }
  function norm(p) { return String(p).replace(/\\/g, '/').toLowerCase(); }
  function baseName(p) { return String(p).replace(/\\/g, '/').replace(/^.*\//, ''); }

  function clipInfo(item, kind) {
    var pi = item.projectItem;
    if (!pi) return null;
    var p = pi.getMediaPath();
    if (!p) return null;
    return { path: p, name: item.name, start: item.start.seconds, end: item.end.seconds, inPoint: item.inPoint.seconds, kind: kind };
  }

  function overlaps(track, from, to) {
    for (var i = 0; i < track.clips.numItems; i++) {
      var c = track.clips[i];
      if (c.start.seconds < to - 0.001 && c.end.seconds > from + 0.001) return true;
    }
    return false;
  }

  function findBin(name, parent) {
    var root = parent || app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
      var c = root.children[i];
      if (c.type === ProjectItemType.BIN && c.name === name) return c;
    }
    return root.createBin(name);
  }

  function findImported(bin, file) {
    var want = norm(file), name = baseName(file);
    for (var i = bin.children.numItems - 1; i >= 0; i--) {
      var c = bin.children[i];
      var mp = '';
      try { mp = c.getMediaPath(); } catch (e) {}
      if ((mp && norm(mp) === want) || c.name === name) return c;
    }
    return null;
  }

  return {
    info: function () {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      return ok({ name: s.name, id: s.sequenceID, width: s.frameSizeHorizontal, height: s.frameSizeVertical, fps: fps(s), projectPath: app.project.path });
    },

    // The clips to transcribe: the selected clips, or else everything on A1 (then V1).
    clips: function () {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      var out = [], seen = {}, i, c;
      function add(item, kind) {
        var info = clipInfo(item, kind);
        if (!info) return;
        var key = norm(info.path) + '@' + info.start.toFixed(3);
        if (seen[key]) return;
        seen[key] = true;
        out.push(info);
      }
      var sel = s.getSelection();
      for (i = 0; i < sel.length; i++) add(sel[i], sel[i].mediaType === 'Audio' ? 'audio' : 'video');
      var selected = out.length > 0;
      if (!selected && s.audioTracks.numTracks > 0) for (i = 0; i < s.audioTracks[0].clips.numItems; i++) add(s.audioTracks[0].clips[i], 'audio');
      if (!out.length && s.videoTracks.numTracks > 0) for (i = 0; i < s.videoTracks[0].clips.numItems; i++) add(s.videoTracks[0].clips[i], 'video');
      out.sort(function (a, b) { return a.start - b.start; });
      return ok({ selected: selected, clips: out });
    },

    playhead: function () {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      return ok({ t: s.getPlayerPosition().seconds, id: s.sequenceID });
    },

    seek: function (seconds) {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      s.setPlayerPosition(String(Math.round(seconds * TICKS)));
      return ok(true);
    },

    // Which of these project item ids still have a clip on the timeline.
    present: function (ids) {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      var want = {}, found = {}, out = [], i, j;
      for (i = 0; i < ids.length; i++) want[ids[i]] = true;
      for (i = 0; i < s.videoTracks.numTracks; i++) {
        var t = s.videoTracks[i];
        for (j = 0; j < t.clips.numItems; j++) {
          var pi = t.clips[j].projectItem;
          if (pi && want[pi.nodeId]) found[pi.nodeId] = true;
        }
      }
      for (i = 0; i < ids.length; i++) if (found[ids[i]]) out.push(ids[i]);
      return ok(out);
    },

    // Puts one clip per caption on the timeline. items: [{file, start, end, name}], each file the first
    // frame of a PNG sequence. removeIds: earlier Kafitz captions to take off the timeline first (their
    // project items move to an "old" bin). hintTrack: the track used last time (0-based), kept if still free.
    placeCaptions: function (items, rate, removeIds, hintTrack, folderName) {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      var bin = findBin(folderName, findBin('Kafitz'));
      var i, j, tracks = s.videoTracks;

      var drop = {};
      for (i = 0; i < removeIds.length; i++) drop[removeIds[i]] = true;
      if (removeIds.length) {
        var oldBin = null;
        for (i = 0; i < tracks.numTracks; i++) {
          for (j = tracks[i].clips.numItems - 1; j >= 0; j--) {
            var c = tracks[i].clips[j];
            if (c.projectItem && drop[c.projectItem.nodeId]) {
              var pi = c.projectItem;
              c.remove(false, false);
              try { if (!oldBin) oldBin = findBin('ישנים', bin); pi.moveBin(oldBin); } catch (e) {}
            }
          }
        }
      }

      var placed = [], from = Infinity, to = -Infinity;
      for (i = 0; i < items.length; i++) {
        var it = items[i];
        if (!app.project.importFiles([it.file], true, bin, true)) return fail('IMPORT_FAILED');
        var item = findImported(bin, it.file);
        if (!item) return fail('IMPORT_NOT_FOUND');
        item.setOverrideFrameRate(rate);
        try { item.name = it.name; } catch (e) {}
        placed.push({ item: item, start: it.start, end: it.end });
        if (it.start < from) from = it.start;
        if (it.end > to) to = it.end;
      }
      if (!placed.length) return ok({ ids: [], track: hintTrack });

      function free(track) {
        for (var k = 0; k < placed.length; k++) if (overlaps(track, placed[k].start, placed[k].end)) return false;
        return true;
      }
      var target;
      if (hintTrack >= 0 && hintTrack < tracks.numTracks && free(tracks[hintTrack])) {
        target = hintTrack;
      } else {
        var top = -1;
        for (i = 0; i < tracks.numTracks; i++) if (overlaps(tracks[i], from, to)) top = i;
        target = top + 1;
        if (target >= tracks.numTracks) {
          try {
            app.enableQE();
            qe.project.getActiveSequence().addTracks(1, tracks.numTracks, 0);
          } catch (e) {}
          tracks = seq().videoTracks;
          if (target >= tracks.numTracks) return fail('NO_FREE_TRACK');
        }
      }
      var ids = [];
      for (i = 0; i < placed.length; i++) {
        tracks[target].overwriteClip(placed[i].item, placed[i].start);
        ids.push(placed[i].item.nodeId);
      }
      return ok({ ids: ids, track: target });
    },

    // Imports an SRT file as a Premiere caption track.
    captions: function (srtFile) {
      var s = seq();
      if (!s) return fail('NO_SEQUENCE');
      var bin = findBin('Kafitz');
      if (!app.project.importFiles([srtFile], true, bin, false)) return fail('IMPORT_FAILED');
      var item = findImported(bin, srtFile);
      if (!item) return fail('IMPORT_NOT_FOUND');
      try {
        var format = (typeof Sequence !== 'undefined' && Sequence.CAPTION_FORMAT_SUBTITLE !== undefined) ? Sequence.CAPTION_FORMAT_SUBTITLE : undefined;
        if (format === undefined) s.createCaptionTrack(item, 0);
        else s.createCaptionTrack(item, 0, format);
      } catch (e) {
        return fail('CAPTION_TRACK');
      }
      return ok(true);
    }
  };
})();
