import Route from '@ember/routing/route';
import { fetchCollection } from '@cardstack/boxel/media';
import { titleize } from '@cardstack/boxel/utils/titleize';

export default class MediaRegistryMusicalWorksWorkRoute extends Route {
  titleToken(model) {
    return `${titleize(model.work.title)} (Musical Work)`;
  }

  async model({ workId }) {
    const works = await fetchCollection('musical-works');
    const masters = await fetchCollection('all_tracks_combined');
    const profiles = await fetchCollection('profiles');

    let { currentOrg, orgs } = this.modelFor('media-registry');
    let work = works.find(el => el.owner_id === currentOrg.id && el.id === workId && !el.version);

    let masterDetail = masters.find(el => el.owner_id === currentOrg.id && el.id === workId && !el.version);
    work.masterDetail = masterDetail;

    if (work.writer_ids && work.writer_ids.length) {
      let writers = profiles.filter(el => work.writer_ids.includes(el.id));
      work.writers = writers;
      work.publisher_ids = work.writers.map(el => el.publisher_id);

      let publishers = orgs.filter(el => work.publisher_ids.includes(el.id));
      publishers.filter(el => el.territory === 'worldwide');
      if (publishers.length) {
        work.publishers = {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: publishers
        };
      }

      work.composers = [];

      work.publishing_representatives = work.writers.map(writer => {
        if (writer.role && writer.role.toLowerCase() === 'lyricist') {
          work.lyricist = writer.title;
        } else if (writer.role && writer.role.toLowerCase() === 'composer') {
          work.composers = [...work.composers, writer.title];
        }

        let publisher = orgs.find(el => el.id === writer.publisher_id);

        return {
          id: `${writer.id}-publishing-representation`,
          version: writer.version,
          type: 'publishing-representation',
          writer,
          role: writer.role,
          publisher: writer.publisher_id ? {
            id: 'worldwide',
            title: 'Worldwide',
            type: 'territory',
            value: [ publisher ]
          } : null
        }
      });
    }

    return {
      currentOrg,
      orgs,
      work
    }
  }
}
