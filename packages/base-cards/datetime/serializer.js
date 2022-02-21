import parseISO from 'date-fns/parseISO';

export function serialize(d) {
  // If the model hasn't been deserialized yet it will still be a string
  if (typeof d === 'string') {
    return d;
  }
  return d.toISOString();
}

export function deserialize(d) {
  return parseISO(d);
}
