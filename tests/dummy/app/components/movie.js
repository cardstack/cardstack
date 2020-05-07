import Component from '@glimmer/component';

export default class MovieComponent extends Component {
  async castSearch(term) {
    const cast = [
      {
        id: "carrie-fisher",
        title: "Carrie Fisher",
        detail: "Leia Organa",
        src: "carrie-fisher.png",
        firstName: "Carrie",
        lastName: "Fisher"
      },
      {
        id: "mark-hamill",
        title: "Mark Hamill",
        detail: "Luke Skywalker",
        src: "mark-hamill.png",
      },
      {
        id: "daisy-ridley",
        title: "Daisy Ridley",
        detail: "Rey",
        src: "daisy-ridley.png",
      },
      {
        id: "adam-driver",
        title: "Adam Driver",
        detail: "Kylo Ren",
        src: "adam-driver.png",
      },
      {
        id: "john-boyega",
        title: "John Boyega",
        detail: "Finn",
        src: "john-boyega.png",
      },
      {
        id: "oscar-isaac",
        title: "Oscar Isaac",
        detail: "Poe Dameron",
        src: "oscar-isaac.png",
      },
      {
        id: "anthony-daniels",
        title: "Anthony Daniels",
        detail: "C-3PO",
        src: "anthony-daniels.png",
      },
      {
        id: "naomie-ackie",
        title: "Naomie Ackie",
        detail: "Jannah",
        src: "naomie-ackie.png",
      },
    ].map(c => ({
      item: c,
      thumb: `/assets/images/${c.src}`,
      title: c.title,
      subtitle: c.detail
    }));

    return cast.filter(c => c.title.toLowerCase().includes(term.toLowerCase()));
  }

  async photosSearch(term) {
    const photos = [
      { id: "sw1", src: "sw1.png", title: "Photo 001", detail: "May 5, 2019", },
      { id: "sw2", src: "sw2.png", title: "Photo 002", detail: "May 5, 2019", },
      { id: "sw3", src: "sw3.png", title: "Photo 003", detail: "May 5, 2019", },
      { id: "sw4", src: "sw4.png", title: "Photo 004", detail: "May 5, 2019", },
      { id: "sw5", src: "sw5.png", title: "Photo 005", detail: "May 5, 2019", },
    ].map(p => ({
      item: p,
      thumb: `/assets/images/${p.src}`,
      title: p.title,
      subtitle: p.detail
    }));

    return photos.filter(p => p.title.toLowerCase().includes(term.toLowerCase()));
  }
}
