import ElizaFarringtonThumb from '../images/workflow/participants/thumb/Eliza-Farrington.jpg';
import HaleyOConnellThumb from '../images/workflow/participants/thumb/Haley-OConnell.jpg';
import JuliaMasonThumb from '../images/workflow/participants/thumb/Julia-Mason.jpg';
import KirstenSchoberThumb from '../images/workflow/participants/thumb/Kirsten-Schober.jpg';
import LolaSampsonThumb from '../images/workflow/participants/thumb/Lola-Sampson.jpg';
import LucasFarrowThumb from '../images/workflow/participants/thumb/Lucas-Farrow.jpg';
import RupertGrishamThumb from '../images/workflow/participants/thumb/Rupert-Grisham.jpg';
import RyanSaintJamesThumb from '../images/workflow/participants/thumb/Ryan-Saint-James.jpg';
import HLCIcon from '../images/workflow/orgs/hlc-icon.png';
import HLCLogo from '../images/workflow/orgs/hlc-logo.png';
import HSHIcon from '../images/workflow/orgs/hsh-icon.png';
import HSHLogo from '../images/workflow/orgs/hsh-logo.png';
import SPWBIcon from '../images/workflow/orgs/spwb-icon.png';
import SPWBLogo from '../images/workflow/orgs/spwb-logo.png';


export default {
  "orgs": [
    {
      "id": "hsh",
      "type": "organization",
      "title": "Home Sweet Home",
      "imgURL": HSHIcon,
      "iconURL": HSHIcon,
      "logoURL": HSHLogo,
      "website": "www.homesweethome.com",
      "address": "112 Milford Ave, Hartford, CT 06106, United States",
      "members": [
        {
          "id": "ryan-saint-james",
          "role": "E-Commerce Manager"
        },
        {
          "id": "haley-oconnell",
          "role": "Store Manager"
        },
        {
          "id": "rupert-grisham",
          "role": "CEO"
        },
        {
          "id": "lola-sampson",
          "role": "Marketing Manager"
        }
      ]
    },
    {
      "id": "spw",
      "type": "organization",
      "title": "Self-Publishing Writers",
      "imgURL": SPWBIcon,
      "iconURL": SPWBIcon,
      "logoURL": SPWBLogo,
      "members": [
        {
          "id": "lucas-farrow",
          "role": "Editor"
        },
        {
          "id": "haley-oconnell",
          "role": "Writer"
        },
        {
          "id": "kirsten-schober",
          "role": "Translator"
        },
        {
          "id": "eliza-farrington",
          "role": "Proofreader"
        }
      ]
    },
    {
      "id": "hlc",
      "type": "organization",
      "title": "Haley's Love Couch",
      "imgURL": HLCIcon,
      "iconURL": HLCIcon,
      "logoURL": HLCLogo
    }
  ],
  "users": [
    {
      "id": "ryan-saint-james",
      "type": "participant",
      "title": "Ryan Saint-James",
      "imgURL": RyanSaintJamesThumb,
      "date_of_birth": "1986-02-12",
      "email": "ryan.saintjames@hsh.com",
      "phone": "+1 860 206 3345",
      "address": "1429 Lester Ave, Hartford, CT 06106, United States",
      "org_ids": ["hsh"]
    },
    {
      "id": "haley-oconnell",
      "type": "participant",
      "title": "Haley O’Connell",
      "imgURL": HaleyOConnellThumb,
      "description": "Writer",
      "date_of_birth": "1980-12-24",
      "email": "haley.oconnell@hsh.com",
      "phone": "+1 860 206 2917",
      "address": "19 Stevenson Blvd, South Windsor, CT 06074, United States",
      "org_ids": ["hsh", "spw", "hlc"]
    },
    {
      "id": "rupert-grisham",
      "type": "participant",
      "title": "Rupert Grisham",
      "imgURL": RupertGrishamThumb,
      "date_of_birth": "1970-12-18",
      "email": "rupert.grisham@hsh.com",
      "phone": "+1 860 206 3819",
      "address": "22 Mandarin St, South Windsor, CT 06074, United States",
      "org_ids": ["hsh"]
    },
    {
      "id": "lola-sampson",
      "type": "participant",
      "title": "Lola Sampson",
      "imgURL": LolaSampsonThumb,
      "date_of_birth": "1988-04-10",
      "email": "lola.sampson@hsh.com",
      "phone": "+1 404 526 9665",
      "address": "701 Manson Ave NE, Atlanta, GA 30312, United States",
      "org_ids": ["hsh"]
    },
    {
      "id": "julia-mason",
      "type": "participant",
      "title": "Julia Mason",
      "imgURL": JuliaMasonThumb,
      "date_of_birth": "1987-04-03",
      "email": "julia-mason@gmail.com",
      "phone": "+1 412 672 0608",
      "address": "44 Mandalay Ave, Glassport, PA 15045, United States",
      "address_2": "82 Laurie St, Glassport, PA 15045, United States",
      "role": "Customer"
    },
    {
      "id": "miriam-jackson",
      "type": "participant",
      "title": "Miriam Jackson"
    },
    {
      "id": "lucy-hatch",
      "type": "participant",
      "title": "Lucy Hatch"
    },
    {
      "id": "martin-stiles",
      "type": "participant",
      "title": "Martin Stiles"
    },
    {
      "id": "seth-johansson",
      "type": "participant",
      "title": "Seth Johansson"
    },
    {
      "id": "alina-mcmillan",
      "type": "participant",
      "title": "Alina McMillan"
    },
    {
      "id": "kevin-collins",
      "type": "participant",
      "title": "Kevin Collins"
    },
    {
      "id": "lucas-farrow",
      "type": "participant",
      "title": "Lucas Farrow",
      "imgURL": LucasFarrowThumb,
      "org_ids": ["spw"]
    },
    {
      "id": "kirsten-schober",
      "type": "participant",
      "title": "Kirsten Schober",
      "imgURL": KirstenSchoberThumb,
      "org_ids": ["spw"]
    },
    {
      "id": "eliza-farrington",
      "type": "participant",
      "title": "Eliza Farrington",
      "imgURL": ElizaFarringtonThumb,
      "org_ids": ["spw"]
    }
  ],
  "queueCards": [
    {
      "id": "1",
      "orgId": "hsh",
      "status": "unread",
      "project": "customers",
      "title": "Purchase Order, Julia Mason",
      "participant_ids": ["julia-mason", "haley-oconnell"],
      "participants": ["Julia Mason", "Haley O'Connell"],
      "datetime": "2020-09-21T20:12",
      "workflow_id": "customer-support",
      "progressPct": "25",
      "currentMilestone": "Reserve products",
      "tasks": [
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Reserve products"
        }
      ]
    },
    {
      "id": "2",
      "orgId": "hsh",
      "status": "needs-response",
      "project": "customers",
      "title": "Personal Shopping Assistance, Miriam Jackson",
      "participant_ids": ["miriam-jackson", "haley-oconnell"],
      "participants": ["Miriam Jackson", "Haley O'Connell"],
      "datetime": "2020-09-21T17:12",
      "workflow_id": "customer-support",
      "progressPct": "75",
      "currentMilestone": "Track delivery",
      "tasks": [
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Track delivery"
        }
      ]
    },
    {
      "id": "3",
      "orgId": "hsh",
      "status": "needs-response",
      "project": "marketing",
      "title": "Newspaper Ad, New Times",
      "participant_ids": ["lucy-hatch", "lola-sampson"],
      "participants": ["Lucy Hatch", "Lola Sampson"],
      "datetime": "2020-09-18T12:57",
      "workflow_id": "advertisement",
      "progressPct": "40",
      "currentMilestone": "Accept"
    },
    {
      "id": "4",
      "orgId": "hsh",
      "status": "needs-response",
      "project": "marketing",
      "title": "Radio Ad, FM8",
      "participant_ids": ["martin-stiles", "lola-sampson"],
      "participants": ["Martin Stiles", "Lola Sampson"],
      "datetime": "2020-09-18T15:17",
      "workflow_id": "advertisement",
      "progressPct": "80",
      "currentMilestone": "Submit files"
    },
    {
      "id": "5",
      "orgId": "hsh",
      "status": "recent-activity",
      "project": "website",
      "title": "Product Catalog, Question",
      "participant_ids": ["ryan-saint-james", "haley-oconnell"],
      "participants": ["Ryan Saint-James", "Haley O'Connell"],
      "datetime": "2020-09-18T11:47"
    },
    {
      "id": "6",
      "orgId": "hsh",
      "status": "recent-activity",
      "project": "hr",
      "title": "Salesperson, Seth Johansson",
      "participant_ids": ["seth-johansson", "rupert-grisham", "haley-oconnell"],
      "participants": ["Seth Johansson", "Rupert Grisham", "Haley O'Connell"],
      "datetime": "2020-09-16T15:23",
      "workflow_id": "job-application",
      "progressPct": "33",
      "currentMilestone": "Review",
      "tasks": [
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "rupert-grisham",
          "title": "Review application"
        }
      ]
    },
    {
      "id": "7",
      "orgId": "hsh",
      "status": "recent-activity",
      "project": "hr",
      "title": "Salesperson, Alina McMillan",
      "participant_ids": ["alina-mcmillan", "rupert-grisham", "haley-oconnell"],
      "participants": ["Alina McMillan", "Rupert Grisham", "Haley O'Connell"],
      "datetime": "2020-09-18T16:25",
      "workflow_id": "job-application",
      "progressPct": "33",
      "currentMilestone": "Review",
      "tasks": [
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "rupert-grisham",
          "title": "Review application"
        }
      ]
    },
    {
      "id": "8",
      "orgId": "hsh",
      "status": "recent-activity",
      "project": "marketing",
      "title": "TV Ad, ZBZ",
      "participant_ids": ["kevin-collins", "lola-sampson"],
      "participants": ["Kevin Collins", "Lola Sampson"],
      "datetime": "2020-09-17T12:17",
      "workflow_id": "advertisement",
      "progressPct": "0",
      "currentMilestone": "Make offer"
    },
    {
      "id": "1",
      "orgId": "spw",
      "status": "unread",
      "project": "Ebook Editing",
      "title": "Ebook editing: The Magic Bird",
      "participant_ids": ["haley-oconnell", "lucas-farrow", "kirsten-schober", "eliza-farrington"],
      "participants": ["Haley O'Connell", "Lucas Farrow", "Kristen Schober", "Eliza Farrington"],
      "datetime": "2020-09-19T16:58",
      "workflow_id": "ebook-editing",
      "progressPct": "40",
      "currentMilestone": "Proofread",
      "tasks": [
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Send to translator",
          "due_date": "2020-09-19",
          "shortcut_link": ""
        },
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "haley-oconnell",
          "title": "Find cover art",
          "due_date": "2020-09-26",
          "shortcut_link": ""
        },
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "haley-oconnell",
          "title": "Draft chapter 2",
          "due_date": "2020-10-03"
        },
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "haley-oconnell",
          "title": "Brainstorm rest of the story",
          "due_date": "2020-10-04"
        },
        {
          "assigned_by": "lucas-farrow",
          "assigned_to": "haley-oconnell",
          "title": "Think about climax"
        },
        {
          "assigned_by": "lucas-farrow",
          "assigned_to": "haley-oconnell",
          "title": "Include conflicts"
        },
        {
          "assigned_by": "system",
          "assigned_to": "eliza-farrington",
          "title": "Proofread content",
          "shortcut_link": ""
        },
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "lucas-farrow",
          "title": "Review chapter outline",
          "shortcut_link": ""
        },
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "lucas-farrow",
          "title": "Make suggestions for storyline"
        },
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Send to proofreader",
          "due_date": "2020-09-19T15:00",
          "completed": true
        },
        {
          "assigned_by": "haley-oconnell",
          "assigned_to": "lucas-farrow",
          "title": "Review edited chapter 1",
          "due_date": "2020-09-19T15:00",
          "completed": true
        },
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Review edits",
          "due_date": "2020-09-19T13:00",
          "completed": true
        },
        {
          "assigned_by": "system",
          "assigned_to": "lucas-farrow",
          "title": "Edit draft",
          "due_date": "2020-09-12T15:00",
          "completed": true
        },
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Share draft",
          "due_date": "2020-09-09T17:00",
          "completed": true
        }
      ]
    },
    {
      "id": "2",
      "orgId": "spw",
      "status": "unread",
      "title": "Recommendations for your reading list",
      "participant_ids": ["haley-oconnell", "randy-stout"],
      "participants": ["Haley O'Connell", "Randy Stout"],
      "datetime": "2020-09-18T12:57"
    },
    {
      "id": "3",
      "orgId": "spw",
      "status": "unread",
      "title": "Writing advice",
      "participant_ids": ["haley-oconnell", "sabrina-milford"],
      "participants": ["Haley O'Connell", "Sabrina Milford"],
      "datetime": "2020-09-18T22:07"
    },
    {
      "id": "4",
      "orgId": "spw",
      "status": "needs-response",
      "project": "Article submission",
      "title": "Article submission: The secret of dealing with customers",
      "participant_ids": ["haley-oconnell"],
      "participants": ["Haley O'Connell"],
      "datetime": "2020-09-17T23:12",
      "workflow_id": "article-submission",
      "progressPct": "20",
      "currentMilestone": "Submit content",
      "tasks": [
        {
          "assigned_by": "system",
          "assigned_to": "haley-oconnell",
          "title": "Submit content"
        }
      ]
    },
    {
      "id": "5",
      "orgId": "spw",
      "status": "recent-activity",
      "project": "Ebook submission",
      "title": "Ebook submission: The Magic Bird",
      "participant_ids": ["haley-oconnell"],
      "participants": ["Haley O'Connell"],
      "datetime": "2020-09-12T16:21",
      "workflow_id": "ebook-editing",
      "isCancelled": true
    },
    {
      "id": "6",
      "orgId": "spw",
      "status": "recent-activity",
      "project": "Article submission",
      "title": "Article submission: Love Triangles",
      "participant_ids": ["haley-oconnell"],
      "participants": ["Haley O'Connell"],
      "datetime": "2020-09-12T16:21",
      "workflow_id": "article-submission",
      "progressPct": "100",
      "isComplete": true
    },
    {
      "id": "7",
      "orgId": "spw",
      "status": "recent-activity",
      "project": "Article editing",
      "title": "Article editing: Love Triangles",
      "participant_ids": ["haley-oconnell", "lucas-farrow"],
      "participants": ["Haley O'Connell", "Lucas Farrow"],
      "datetime": "2020-09-11T16:25",
      "progressPct": "100",
      "isComplete": true
    },
    {
      "id": "8",
      "orgId": "spw",
      "status": "recent-activity",
      "title": "Random question",
      "participant_ids": ["haley-oconnell", "conny-james"],
      "participants": ["Haley O'Connell", "Conny James"],
      "datetime": "2020-09-09T23:47"
    },
    {
      "id": "1",
      "orgId": "hlc"
    }
  ],
  "messages": [
    {
      "id": "1",
      "orgId": "hsh",
      "threadId": "1",
      "participantId": "hsh",
      "participantType": "bot",
      "datetime": "2020-09-21T20:12",
      "content": "You have placed an order for an item that requires a manual inventory check. Your credit card has not been charged. If the products are in stock, we will reserve them for you and proceed to the payment process. You will receive status updates via email and in this thread."
    },
    {
      "id": "1",
      "orgId": "spw",
      "threadId": "1",
      "participantId": "lucas-farrow",
      "datetime": "2020-09-12T14:49",
      "content": "Hi Haley, Here’s your manuscript with all the edits I would recommend. Please review and let me know if you have any questions. I also added a couple tasks for you about things you should think about, as you figure out the rest of your story."
    }
  ],
  "workflows": [
    {
      "id": "customer-support",
      "title": "Customer Support",
      "milestones": [
        {
          "id": "1",
          "pct": "0",
          "title": "Place order"
        },
        {
          "id": "2",
          "pct": "25",
          "title": "Reserve products",
          "description": "Order placed"
        },
        {
          "id": "3",
          "pct": "50",
          "title": "Submit payment",
          "description": "Products reserved"
        },
        {
          "id": "4",
          "pct": "75",
          "title": "Track delivery",
          "description": "Payment submitted"
        }
      ],
      "completion": {
        "id": "5",
        "pct": "100",
        "description": "Delivery tracked"
      }
    },
    {
      "id": "advertisement",
      "title": "Advertisement",
      "milestones": [
        {
          "id": "1",
          "pct": "0",
          "title": "Offer"
        },
        {
          "id": "2",
          "pct": "20",
          "title": "Review",
          "description": "Offer made"
        },
        {
          "id": "3",
          "pct": "40",
          "title": "Accept",
          "description": "Offer reviewed"
        },
        {
          "id": "4",
          "pct": "60",
          "title": "Submit payment",
          "description": "Offer accepted"
        },
        {
          "id": "5",
          "pct": "80",
          "title": "Submit files",
          "description": "Payment submitted"
        }
      ],
      "completion": {
        "id": "6",
        "pct": "100",
        "description": "Files submitted"
      }
    },
    {
      "id": "job-application",
      "title": "Job Application",
      "milestones": [
        {
          "id": "1",
          "pct": "0",
          "title": "Submit"
        },
        {
          "id": "2",
          "pct": "33",
          "title": "Review",
          "description": "Application submitted"
        },
        {
          "id": "3",
          "pct": "66",
          "title": "Accept / Deny",
          "description": "Application reviewed"
        }
      ],
      "completion": {
        "id": "4",
        "pct": "100"
      }
    },
    {
      "id": "ebook-editing",
      "title": "Ebook Editing",
      "milestones": [
        {
          "id": "1",
          "pct": "0",
          "title": "Share"
        },
        {
          "id": "2",
          "pct": "20",
          "title": "Edit",
          "description": "Manuscript shared"
        },
        {
          "id": "3",
          "pct": "40",
          "title": "Proofread",
          "description": "Manuscript edited"
        },
        {
          "id": "4",
          "pct": "60",
          "title": "Translate",
          "description": "Manuscript proofread"
        },
        {
          "id": "5",
          "pct": "80",
          "title": "Submit",
          "description": "Manuscript translated"
        }
      ],
      "completion": {
        "id": "6",
        "pct": "100",
        "description": "Manuscript submitted"
      }
    },
    {
      "id": "article-submission",
      "title": "Article Submission",
      "milestones": [
        {
          "id": "1",
          "pct": "0",
          "title": "Accept terms"
        },
        {
          "id": "2",
          "pct": "20",
          "title": "Submit content",
          "description": "Terms accepted"
        },
        {
          "id": "3",
          "pct": "40",
          "title": "Select category",
          "description": "Content submitted"
        },
        {
          "id": "4",
          "pct": "60",
          "title": "Review content",
          "description": "Category selected"
        },
        {
          "id": "5",
          "pct": "80",
          "title": "Approve & publish",
          "description": "Content reviewed"
        }
      ],
      "completion": {
        "id": "6",
        "pct": "100",
        "description": "Approved & published"
      }
    }
  ]
}
