import Service from '@ember/service';

export interface CardstackSession {
  isAuthenticated: boolean;
}

export default Service.extend({
  isAuthenticated: true,
});
