import { contains } from '@cardstack/types';
import String from 'https://cardstack.com/base/string';
import Profile from 'https://demo.com/profile';
import Bio from 'https://demo.com/bio';
import Links from 'https://demo.com/links';
import Donations from 'https://demo.com/donations';

export default class CardSpaceLayout {
  @contains(String)
  title;

  @contains(Profile)
  profile;

  @contains(Bio)
  bio;

  @contains(Links)
  links;

  @contains(Donations)
  donations;
}
