import { parse, format } from 'date-fns';

export function serialize(d) {
  // If the model hasn't been deserialized yet it will still be a string
  if (typeof d === 'string') {
    return d;
  }
  return format(d, 'yyyy-MM-dd');
}

export function deserialize(d) {
  return parse(d, 'yyyy-MM-dd', new Date());
}
