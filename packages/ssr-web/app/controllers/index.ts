import Controller from '@ember/controller';

class IndexController extends Controller {
  queryParams = [
    {
      cardSpaceId: 'card-space-id',
    },
  ];
}

export default IndexController;
