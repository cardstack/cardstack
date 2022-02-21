import parse from 'date-fns/parse';
import format from 'date-fns/format';

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

export default { serialize, deserialize };
