import chai from 'chai';
import { resolveDoc } from '../sdk/utils/general-utils';

describe('Resolves a god damn web did',  () => {
  it('gone and done it', async() => {
    let result= await resolveDoc('did:web:superb-conkies-141fd5.netlify.app:subfolder');
    chai
      .expect(result)
      .to.eq(
        'helloboop'
      );
  });

  it('root', async() => {
    let result= await resolveDoc('did:web:superb-conkies-141fd5.netlify.app');
    chai
      .expect(result)
      .to.eq(
        'helloboop'
      );
  });
});
