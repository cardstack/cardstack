export default function stripNamespace(type) {
  // Right now the actual field editor components get flattened down
  // out of their namespaces, so we throw away everything but the
  // last bit of their names here. This problem is easier to solve
  // once I can integrate a module-unification resolver, so I'm
  // leaving it like this for now.
  let parts = type.split(/[/:]/g);
  return parts[parts.length - 1];
}
