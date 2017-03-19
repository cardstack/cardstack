// This implements Range.getBoundingClientRect correctly, whereas it
// is broken in Chrome at the moment
// https://bugs.chromium.org/p/chromium/issues/detail?id=574363
export function boundingClientRect(range) {
  let rects = range.getClientRects();
  if (rects.length === 0) {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0
    };
  }
  let first = rects[0];
  let output = {
    top: first.top,
    bottom: first.bottom,
    left: first.left,
    right: first.right,
    width: first.width,
    height: first.height
  };
  for (let i =1; i < rects.length; i++) {
    let rect = rects[i];
    if (rect.left - rect.right !== 0 || rect.top - rect.bottom !== 0) {
      output.top = Math.min(output.top, rect.top);
      output.bototm = Math.max(output.bottom, rect.bottom);
      output.left = Math.min(output.left, rect.left);
      output.right = Math.max(output.right, rect.right);
      output.width = output.right - output.left;
      output.height = output.bottom - output.top;
    }
  }
  return output;
}

const tolerance = 1;

export function boundsEqual(a, b) {
  if (a == null && b == null) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.top - b.top) < tolerance &&
    Math.abs(a.bottom - b.bottom) < tolerance &&
    Math.abs(a.left - b.left) < tolerance &&
    Math.abs(a.right - b.right) < tolerance;
}

export function topLeftEqual(a, b) {
  if (a == null && b == null) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.top - b.top) < tolerance &&
    Math.abs(a.left - b.left) < tolerance;
}
