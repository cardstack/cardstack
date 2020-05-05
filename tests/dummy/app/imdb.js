import StarWarsVersions from './star-wars-versions';

export default {
  movies: [
    {
      id: "star-trek-picard",
      title: { value: "Star Trek: Picard" },
      type: { value: "TV Series" },
      year: { value: 2020 },
      poster: { type: "image", value: "star-trek-picard@2x.png" },
    },
    {
      id: "star-trek-tng",
      title: { value: "Star Trek: TNG" },
      type: { value: "TV Series" },
      year: { value: 1987 },
      poster: { type: "image", value: "star-trek@2x.png" },
    },
    {
      id: "star-wars-the-clone-wars",
      title: { value: "Star Wars: The Clone Wars" },
      type: { value: "TV Series" },
      year: { value: 2008 },
      poster: { type: "image", value: "star-wars-clone@2x.png" },
    },
    StarWarsVersions.latest,
    {
      id: "stargate",
      title: { value: "Stargate" },
      year: { value: 1994 },
      poster: { type: "image", value: "stargate@2x.png" },
    },
    {
      id: "starship-troopers",
      title: { value: "Starship Troopers" },
      year: { value: 1997 },
      poster: { type: "image", value: "starship-troopers@2x.png" },
    },
    {
      id: "starman",
      title: { value: "Starman" },
      year: { value: 1984 },
      poster: { type: "image", value: "starman@2x.png" },
    },
    {
      id: "dark-star",
      title: { value: "Dark Star" },
      year: { value: 1974 },
      poster: { type: "image", value: "dark-star@2x.png" },
    },
  ],
  versioning: [
    {
      movieId: "star-wars-the-rise-of-skywalker",
      versions: [
        {
          id: 1,
          published: 'Dec 9, 3:00 PM, 2019',
          savedData: StarWarsVersions.version1
        },
        {
          id: 2,
          published: 'Dec 10, 3:00 PM, 2019',
          savedData: StarWarsVersions.version2
        },
        {
          id: 3,
          published: 'Dec 16, 1:15 PM, 2019',
          savedData: StarWarsVersions.version3
        },
        {
          id: 4,
          published: 'Apr 1, 3:00 PM',
          savedData: StarWarsVersions.version4
        },
        {
          id: 5,
          published: 'Apr 2, 8:32 PM',
          savedData: StarWarsVersions.version5
        },
        {
          id: 6,
          published: 'Apr 3, 6:15 PM',
          description: 'Revised description',
          savedData: StarWarsVersions.version6
        },
        {
          id: 7,
          published: 'Apr 5, 10:22 AM',
          savedData: StarWarsVersions.version7
        },
        {
          id: 8,
          published: 'Apr 5, 1:04 PM',
          savedData: StarWarsVersions.version8
        },
        {
          id: 9,
          published: 'Apr 6, 11:36 AM',
          description: 'Added 3 cast members',
          savedData: StarWarsVersions.version9
        },
        {
          id: 10,
          published: 'Apr 7, 2:30 PM',
          savedData: StarWarsVersions.latest
        },
      ],
    }
  ]
};
