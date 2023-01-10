import Service from '@ember/service';

export default interface DateService extends Service {
  now(): number;
}
