import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

const IMAGE_EDITOR_ROOT = '[data-test-image-editor]';
const IMAGE_EDITOR_ERROR_OVERLAY = '[data-test-image-editor-error-overlay]';
const IMAGE_EDITOR_ERRORED_EXIT_BUTTON =
  '[data-test-image-editor-errored-exit-button]';
const ROTATE_CCW_BUTTON = '[data-test-image-editor-rotate-ccw-button]';
const PREVIEW = '[data-test-image-editor-preview]';
const SAVE_BUTTON = '[data-test-image-editor-save-button]';
const CANCEL_BUTTON = '[data-test-image-editor-cancel-button]';

let imageDataUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAkCAYAAACTz/ouAAAMbmlDQ1BJQ0MgUHJvZmlsZQAASImVVwdYU8kWnluSkJACBBCQEnoTpBNASggtgPQi2AhJIKHEmBBU7GVRwbWLKFZ0VUSxrYDYsa8sit21LBZUlHVRFxsqb0ICuu4r3zvfN/f+OXPmP+XO5N4DAOM9XyYrQHUAKJQWyZMiQ1mjMjJZpA5ABnSgD2wAgy9QyDgJCbEAysD97/L2BkBU96suKq5/zv9X0ROKFAIAkDEQZwsVgkKITwCArxPI5EUAEFV660lFMhWeBbG+HAYI8UoVzlXjHSqcrcZH+m1SkrgQXwZAi8rny3MBoN+FelaxIBfy0D9B7CYVSqQAMIZBHCQQ84UQq2IfVlg4QYUrIXaA9jKIYTyAnf0NZ+7f+LMH+fn83EGszqtftMIkClkBf8r/WZr/LYUFygEfdnBQxfKoJFX+sIa38ifEqDAV4i5pdly8qtYQv5cI1XUHAKWIlVGpanvUVKDgwvoBQ4jdhPywGIhNIY6QFsTFavTZOZIIHsRwt6CTJUW8FIiNIF4gUoQna2w2ySckaXyh9TlyLkejP8+X9/tV+bqvzE/laPhfi0U8DT9GLxGnpENMgdimWJIWBzEdYldFfnKMxmZEiZgbN2AjVyap4reBOEkkjQxV82PFOfKIJI19WaFiIF9sk1jCi9Pg/UXilCh1fbDTAn5//DAX7LJIykkd4BEpRsUO5CIUhYWrc8eeiaSpyRqe97Ki0CT1WpwiK0jQ2ONWooJIld4KYi9FcbJmLZ5WBDenmh/PkRUlpKjjxEvy+NEJ6njwpSAWcEEYYAElHNlgAsgDktauhi74Sz0TAfhADnKBCLhoNAMr0vtnpPCaDErAHxCJgGJwXWj/rAgUQ/3nQa366gJy+meL+1fkgycQF4IYUAB/K/tXSQe9pYHHUCP5h3c+HAIYbwEcqvl/rx/QftVwoCZWo1EOeGQxBiyJ4cQwYhQxguiIm+BBeAAeC68hcHjgbNxvII+v9oQnhDbCQ8J1Qjvh9njJHPl3UY4E7ZA/QlOL7G9rgdtBTm88FA+E7JAZN8RNgAvuBf1w8GDo2RtquZq4VVVhfcf9twy+eRoaO7IbGSUPIYeQHb5fSXeiew+yqGr9bX3UsWYP1ps7OPO9f+431RfCe8z3ltgC7AB2DjuJXcCOYA2AhR3HGrEW7KgKD+6ux/27a8BbUn88+ZBH8g9/fI1PVSUVbrVunW6f1HNFoslFqoPHnSCbIpfkiotYHPh2ELF4UoHrMJaHm4c7AKp3jfrv601i/zsEMWz5qpv7OwCBx/v6+g5/1UUfB2CfLzz+h77qHNgA6GoDcP6QQCkvVutw1YUA/yUY8KQZA3NgDRxgPh7ABwSAEBAOokE8SAEZYBysshjuczmYBKaB2aAUlIOlYBVYCzaCLWAH2A32gwZwBJwEZ8FFcBlcB3fg7ukAL0A3eAt6EQQhITSEiRgjFogt4ox4IGwkCAlHYpEkJAPJQnIRKaJEpiFzkXJkObIW2YzUIPuQQ8hJ5ALShtxGHiCdyGvkI4qhVFQfNUPt0OEoG+WgMWgKOhbNRSeiJeg8dDFaiVaju9B69CR6Eb2OtqMv0B4MYNqYIWaJuWBsjIvFY5lYDibHZmBlWAVWjdVhTfA5X8XasS7sA07EmTgLd4E7OApPxQX4RHwGvghfi+/A6/HT+FX8Ad6NfyHQCKYEZ4I/gUcYRcglTCKUEioI2wgHCWfgWeogvCUSiYZEe6IvPIsZxDziVOIi4nriHuIJYhvxEbGHRCIZk5xJgaR4Ep9URColrSHtIh0nXSF1kN5raWtZaHloRWhlakm15mhVaO3UOqZ1ReupVi9Zh2xL9ifHk4XkKeQl5K3kJvIlcge5l6JLsacEUlIoeZTZlEpKHeUM5S7ljba2tpW2n3aitkR7lnal9l7t89oPtD9Q9ahOVC51DFVJXUzdTj1BvU19Q6PR7GghtExaEW0xrYZ2inaf9p7OpLvSeXQhfSa9il5Pv0J/ySAzbBkcxjhGCaOCcYBxidGlQ9ax0+Hq8HVm6FTpHNK5qdOjy9R1143XLdRdpLtT94LuMz2Snp1euJ5Qb57eFr1Teo+YGNOayWUKmHOZW5lnmB36RH17fZ5+nn65/m79Vv1uAz0DL4M0g8kGVQZHDdoNMUM7Q55hgeESw/2GNww/DjEbwhkiGrJwSN2QK0PeGQ01CjESGZUZ7TG6bvTRmGUcbpxvvMy4wfieCW7iZJJoMslkg8kZk66h+kMDhgqGlg3dP/Q3U9TUyTTJdKrpFtMW0x4zc7NIM5nZGrNTZl3mhuYh5nnmK82PmXdaMC2CLCQWKy2OWzxnGbA4rAJWJes0q9vS1DLKUmm52bLVstfK3irVao7VHqt71hRrtnWO9UrrZutuGwubkTbTbGptfrMl27Jtxbarbc/ZvrOzt0u3m2/XYPfM3sieZ19iX2t/14HmEOww0aHa4Zoj0ZHtmO+43vGyE+rk7SR2qnK65Iw6+zhLnNc7tw0jDPMbJh1WPeymC9WF41LsUuvywNXQNdZ1jmuD68vhNsMzhy8bfm74FzdvtwK3rW533PXco93nuDe5v/Zw8hB4VHlc86R5RnjO9Gz0fOXl7CXy2uB1y5vpPdJ7vnez92cfXx+5T51Pp6+Nb5bvOt+bbH12AnsR+7wfwS/Ub6bfEb8P/j7+Rf77/f8McAnID9gZ8GyE/QjRiK0jHgVaBfIDNwe2B7GCsoI2BbUHWwbzg6uDH4ZYhwhDtoU85Thy8ji7OC9D3ULloQdD33H9udO5J8KwsMiwsrDWcL3w1PC14fcjrCJyI2ojuiO9I6dGnogiRMVELYu6yTPjCXg1vO5o3+jp0adjqDHJMWtjHsY6xcpjm0aiI6NHrhh5N842ThrXEA/iefEr4u8l2CdMTDicSExMSKxKfJLknjQt6VwyM3l88s7ktymhKUtS7qQ6pCpTm9MYaWPSatLepYelL09vHzV81PRRFzNMMiQZjZmkzLTMbZk9o8NHrxrdMcZ7TOmYG2Ptx04ee2GcybiCcUfHM8bzxx/IImSlZ+3M+sSP51fze7J52euyuwVcwWrBC2GIcKWwUxQoWi56mhOYszznWW5g7orcTnGwuELcJeFK1kpe5UXlbcx7lx+fvz2/ryC9YE+hVmFW4SGpnjRfenqC+YTJE9pkzrJSWftE/4mrJnbLY+TbFIhirKKxSB9+1LcoHZQ/KB8UBxVXFb+flDbpwGTdydLJLVOcpiyc8rQkouSnqfhUwdTmaZbTZk97MJ0zffMMZEb2jOaZ1jPnzeyYFTlrx2zK7PzZv85xm7N8zl9z0+c2zTObN2veox8if6gtpZfKS2/OD5i/cQG+QLKgdaHnwjULv5QJy34pdyuvKP+0SLDolx/df6z8sW9xzuLWJT5LNiwlLpUuvbEseNmO5brLS5Y/WjFyRf1K1sqylX+tGr/qQoVXxcbVlNXK1e2VsZWNa2zWLF3zaa147fWq0Ko960zXLVz3br1w/ZUNIRvqNpptLN/4cZNk063NkZvrq+2qK7YQtxRvebI1beu5n9g/1Wwz2Va+7fN26fb2HUk7Ttf41tTsNN25pBatVdZ27hqz6/LusN2NdS51m/cY7infC/Yq9z7fl7Xvxv6Y/c0H2Afqfrb9ed1B5sGyeqR+Sn13g7ihvTGjse1Q9KHmpoCmg4ddD28/Ynmk6qjB0SXHKMfmHes7XnK854TsRNfJ3JOPmsc33zk16tS104mnW8/EnDl/NuLsqXOcc8fPB54/csH/wqFf2L80XPS5WN/i3XLwV+9fD7b6tNZf8r3UeNnvclPbiLZjV4KvnLwadvXsNd61i9fjrrfdSL1x6+aYm+23hLee3S64/eq34t9678y6S7hbdk/nXsV90/vVvzv+vqfdp/3og7AHLQ+TH955JHj04rHi8aeOeU9oTyqeWjyteebx7EhnROfl56Ofd7yQvejtKv1D9491Lx1e/vxnyJ8t3aO6O17JX/W9XvTG+M32v7z+au5J6Ln/tvBt77uy98bvd3xgfzj3Mf3j095Jn0ifKj87fm76EvPlbl9hX5+ML+f3fwpgcKA5OQC83g4ALQMAJuzbKKPVvWC/IOr+tR+B/4TV/WK/+ABQB7/fE7vg181NAPZuhe0X5GfAXjWBBkCKH0A9PQeHRhQ5nh5qLirsUwj3+/rewJ6NtAKAz0v7+nqr+/o+b4HBwt7xhFTdg6qECHuGTbzP2YXZ4N+Iuj/9Jsfv70AVgRf4/v4vjkmQxU8qxzEAAACKZVhJZk1NACoAAAAIAAQBGgAFAAAAAQAAAD4BGwAFAAAAAQAAAEYBKAADAAAAAQACAACHaQAEAAAAAQAAAE4AAAAAAAAAkAAAAAEAAACQAAAAAQADkoYABwAAABIAAAB4oAIABAAAAAEAAAAYoAMABAAAAAEAAAAkAAAAAEFTQ0lJAAAAU2NyZWVuc2hvdFpokPcAAAAJcEhZcwAAFiUAABYlAUlSJPAAAAHUaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPGV4aWY6UGl4ZWxZRGltZW5zaW9uPjM2PC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjI0PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6VXNlckNvbW1lbnQ+U2NyZWVuc2hvdDwvZXhpZjpVc2VyQ29tbWVudD4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CimzfykAAAAcaURPVAAAAAIAAAAAAAAAEgAAACgAAAASAAAAEgAAAllA95toAAACJUlEQVRIDWSVW3bDIBBDg/e/3Difdu+VhiRtOSmGkUbzALvrPF/348Fvxlos7vW4sLncY0G5joWt9BtOuOxlHgsPbBnKwX1cIOd5Rr00jFtVEIVblbvBQpyI8o9g3+kN2JDMFwGeBIiuuVXCOXHUJpBCJpes41zRiR1VfQ7+oqDzhQaG9aKCZClEpkq3Ea67T7QvTLvIhl066ocyodIR+rrOFwF2llEydOmmvRC+D+TuOgUR18TzEI+D8oq3WnFpnAGHbHYRsU0VDezJOmCuHKBi2VZU3CSweSkcrhPZvS160qIYd0PHSV7SzBPGKNvOZh1gzBvEFrFJgjUVPEHNnNnVaGnTqmAKlCEmcYZaU5hQNDa2n7mmAXV8X4MNRxPRT2QF5Q/yIWpN9b+haVFCxEeOo6Ku/sq1sh7n/zB67FJkcotoUU+hQPUivIjGBZsQ9eQEPsFN5s0X79DPdybwk1uUpTtbtFNj2brMw9gSOqrLzPl4u95YieyxTyv6qRhA99K/DMpLvnxCsFqudEzhD57TD2Gso+SnYuFw8yKlR1skGW+HP92D2Wi73NaUivTzh6svcCoYOG6Cvaof6ztMAO0dtZMp5VhRvlUscq0NYKv21zQuufOajUJFiaGD58CXUSRXFkxRnNIZndkkSJdxje07wHRN+ojr5xEqjckE3Bkfw0WHUpR40h4//Wf8O+QkHTUFm1X+L0w1ijsM1PDzfo5PwK/pBwAA//9Ld5Z4AAACHUlEQVRVlFuihCAMQ8X9L3f0UyYnaUGZe0H6SNKCjuu65nGMY+o39Du8MvfAc8rzyCA/IY8itU7Zhh7mTF4yHKA4AhR3XT8TFLaNx8CkfycGk+RNGij2wGVIiEBHk5VTBFTAeIdTkdRJueR+E19it4YY2/VBgoASV8mC9bM6EhvUUNGizAAfpyZWJtYOdkmbalcgmxWRA8lMyYUim1Hs5dmkYFNkD+3ftQuCM7iln2QATx0YR6qdCLGefnBmtQpw9hJBnM8+F4RHBnYmRI77vubjfBADhN/De4ebzE8KCULF9LLaXAGV6wqstQ1KICQo1pr2wm1V+KGK6qqnOCsIMvlNtW5RcgIMWfeJsJ3X7CUgN2FdTcHqzhVZQtYhm1PAtBwuRg7aTDHYqAlCFq0Jjl5m47RY4lwBqOvagRKhTZTrpR0GH6pWniF4jbcpz6LrFrUza/d3Z+el6rQXtg/31RhXRR2xieDnF+1ULr687pEGHFItWgy+B7Yltuk4/PSrnLVAo2t6O7POvDItI20wrQLFAjk9IpE/n4Esxq+5d+YgjBctqKGNmi4wNmZa9KhMv5RkuDV4kKZPiRTkq2qTzlToesHWGSQMSpI0cIrNqiUVM3X1IP5EzUfe9vL18gfz+ulratxcNUIAMg/5IgKIi2bV8uJzjG1kZL8uNAG8IjKMm69p+gKCPLShyYrKiNsHHLuw8JCRPK4E6unAPP6jk7WCZgKMugAAAABJRU5ErkJggg==';
let rotatedAndCroppedImageDataUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAYAAACAvzbMAAAAAXNSR0IArs4c6QAAIABJREFUeF7tndFa4zoMBhPe/3EPe0nP15SFLqT4lzwtgW/2dpXEGcmeyCnt+vz8fFq++x85ghW6Geo8y7KsJ+5kp5WBBZ1mYUYD5ewep+FStywv0ADJMR1sSOBU4Xif5zDE/KjzpXt7qwK5MYO6RHdOp0CgVeo7TgPWgQIZJ1CBjBndI6Jb5grkVja6RBXIPer7+84J1oECGadRgYwZ3SOiW+YKRIFM1eNRW/Kpm7o+uDuz9gbgFtYwLQpkiOguAd0yVyAKZKogFUgBnwIZwlIgQ0R3CVAgf7F2SXxMC3UeX6LfpeAfdlKwDtzCGmdNgYwZ3SOiW+Z2IHYgU/VoB1LAZwcyhKVAhojuEqBA7EBKheXHeENc3ZnlO5AQ8L9hCqSFbfqgbpnbgdiBTBWfHUgBnx3IEJYCGSK6S4ACsQMpFZYdSIirO7PsQELAdiAtUPBB3TK3A7EDmSpFO5ACPjuQISw7kCGiuwQoEDuQUmHZgYS4ujPLDiQEbAfSAgUf1C1zOxA7kKlStAMp4LMDGcKyAxkiukuAArEDKRWWHUiIqzuz7EBCwHYgLVDwQd0y73cg3Svec2Kd/2jviXkmfjk9YSlawe+spbC/MJiWJ2pAywJSwlIHj4qBBaVug7Qu1JiYUTGjoZ8mD1pPJKxm+hTIjdpQINmkUSAZp0sUM+Obc313oAqkkj8iFsweU06Xm2oOS4EokKlZoUAq+JgZ35zrCqSSqrvFgtljykmBXOfaLays8t3Cyji1H81uLNfpVb+KA5cgt7CIhJTOAWZPgbySpz6d4juQuJQVSIoKnPBuYQ2hk2sitWU4HHQpAKwnElZzWG5huYVVKv+PwW5hVfAxM745193CqqTqbrFg9phycgvLLax6tduBpMzACW8HMoROrol2IEPc7wHNMrcDsQMpVNnnUDuQCj5meWzOdTuQSqruFgtmjyknOxA7kHq124GkzMAJbwcyhE6uiXYgQ9x2IB8R+SmsrGgUSMbJT2FlnE7dPyT4cHoFkvHeokhYzeckt7DcwipUrFtYU7CgGd+c625hzSUPOhrMngJ5zYkf442Lk6oZO5AUOTjhFcgQOlXflwuxZxsOPgoA64m8veaw7EDsQKKyvxXkS/QKPmbGN+e6HUglVXeLBbPHlNPlTpvDUiAKZGqqKJAKPmbGN+e6Aqmk6m6xYPaYclIg17n2JXpW+W5hZZzaj2Y3luv0ql/FgUuQX2VCJKR0DjB7CuSVvO9A4hKkakaBpMjBCQ/tybMjYirKT2F9Qz0xqbMDsQNJi/c9ToGkzNjlOr2qHQhBilxhifFMvGzYuzx5e80y9x2I70CmZobvQCr4mBnfnOu+A6mk6m6xYPaYcrIDsQOpV7sdSMoMnPBuYQ2hk2uiH+Md4n4PaJZ5vwMpjM3QZnZ2wK0rM8VO3JB+eXoZ3iyk4yWP+tnmF0iyZ95o5qCTkfOO+9Ht/kdFFAg7s2+cjZvwCuQhCbu6CLRyoMPm6okalgLJSCqQjJNR/xDgJrwCeXRpKZCEuAJJKC2LAsk4GaVAfkkNKJAkkQokoaRAMkpGfSBgB/JzS0KBJLlTIAklBZJRMkqB/JoaUCBJKhVIQkmBZJSMUiC/pgYUSJJKBZJQUiAZJaMUyK+pAQWSpFKBJJQUSEbJKAXya2pAgSSpVCAJJQWSUTJKgfyaGlAgSSoVSEJJgWSUjFIgv6YGFEiSSgWSUFIgGSWjFMivqQEFkqRSgSSUFEhGySgF8mtqQIEkqVQgCSUFklEySoH8mhpQIEkqFUhCSYFklIxSIL+mBhRIkkoFklBSIBkloxTIr6kBBZKkUoEklBRIRskoBfJrakCBJKlUIAklBZJRMkqB/JoaUCBJKhVIQkmBZJSMUiC/pgYUSJJKBZJQUiDvlMh5xX3beZbFJOqo90f9pO1LAmEc87RyyTtRzLkhjQEUIqj7ewLvD/uBIyh34K0tT+CP2p4WZsKsC/dDtNSYziW8Nln1f9IWKpht/pFVU5jQX4Ye9f4UyDjDR6ync5lDNaVAxiVwjlAgGScFknPKI6HJjgtSgYxzqEDGjF4j7EAyVNTTvh3IX95HXWCzehhHHfX+FMg4dwpkzEiBxIwumyRuYe0BcwvrVhkpkGiC+Q4kwnRpRKGacgsrY+4WVsbJLaycUx4JTXa3sHLk1AJ7yHdqCiQqBLJ5VCAR8i3Il+g5qyxSgUSc7EAiTHYgISYFEoICt9UUSM48j1QgESsFEmFSICEmBRKCUiBXoMiqyfl/HalAIpIKJMKkQEJM5FLgFlYI3S2sHFQcqUAiVAokwqRAQkwKJARlB2IHkpfKVaQf4x1jI1eh8dXiCOpDAn4KK0NuB5Jx8h1IzimPtAOJWNmBRJjsQEJMpPsVSAjdLawcVBypQCJUCiTCpEBCTAokBOUWlltYeam4hVViRa5CpQt/HewW1hgmmTo7kDHvvxH+HUjOKou0A4k42YFEmOxAQkwKJARlB2IHkpeKHUiJFbkKlS5sBzKLi0ydHUieDTuQnFUWaQcScbIDiTDZgYSYFEgIyg7EDiQvFTuQEityFSpd2A5kFheZOjuQPBvtDuTP83MrZ6fmL1jt31JrCDmdb48k749sjQAw5HCYb8w+/5IQ949MHfYtjyR0CBU0JPAHLpcT9amFMyJoYBCmLWnUdNlur1kGqwJpkisdRq5C3VSXBpwHk8OhZoQCyfNHRUJ1AK3Tly1DBRJnt5s+BRIjnglUIBE9BRJh6j8vhqfvhHVXoA/XUiA5fGq62IHkzL8pUoFE4KkZYQcS4UaDFEiEE8LkFta/tMkFNsrjg4PI+yNLEMBADkeBhAkhoYeXHIVBQ7IDGYF+/39qutiB5My/KVKBROCpGWEHEuFGgxRIhBPCZAdiBxLV204QWYLdMVwdRw5HgYQJIaGHlxyFQUOyAxmBtgPZIUQ+oecJeFwkeX/QTKVunhyOAgmzQkIPLzkKg4akQEagFYgCyWvEDqTDyi2sDrW5YxRIxA/C5BaWW1hRvSmQDiYF0qE2dwy0MtqB5GmgGvbzFbvp8+9A8nxNRLqFFcGjZoQCiXCjQd0V6MMgFEieFWq6KJCc+TdFKpAIPDUjFEiEGw1SIBFOCJNbWG5hRfXmFlYHkwLpUJs7BloZ7UDyNFDPW3YgOfNvirQDicBTM0KBRLjRIAUS4YQw2YHYgUT1ZgfSwaRAOtTmjoFWRjuQPA3U85YdSM78myLtQCLw1IxQIBFuNEiBRDghTHYgdiBRvdmBdDApkA61uWOgldEOJE8D9bxlB5Iz/6ZIO5AIPDUjFEiEGw1SIBFOCJMdiB1IVG92IB1MCqRDbe4YaGW0A8nTQD1vTXUgz82ftM1v08j2n3nuoTsx3cxpZWY8OuEhUE/YT8cuyzF/upnJ3VZeJ2gZeoLGBNX3ZepAYzpjgpYx9nfaoUFdCqF1slWBtLjVDuLq+Pw7nbVr34hWIBlGBZJxWhRIBEqBRJgM+oeAAokKglqs7UAi3JcgO5AIFvPYtiwKJMJtkAKp14ACSZmBTyQKJIKuQPYxuYUVlc9kEDjf3cIa58IOZMzoLUKBRLAUiAKJCuUuQQokwmoHEmFCXw67hZUxVyAKJKuUe0QpkIiqAokwKZAUk5/Cikn5KawCqoeHKpAIuQKJMCmQFJMCiUkpkAKqh4cqkAi5AokwKZAUkwKJSSmQAqqHhyqQCLkCiTApkBSTAolJKZACqoeHKpAIuQKJMCmQFJMCiUkpkAKqh4cqkAi5AokwKZAUkwKJSSmQAqqHhyqQCLkCiTApkBSTAolJKZACqoeHKpAIuQKJMCmQFJMCiUkpkAKqh4cqkAi5AokwKZAUkwKJSSmQAqqHhyqQCLkCiTApkBSTAolJKZACqoeHKpAIuQKJMCmQFJMCiUkpkAKqh4cqkAi5AokwKZAUkwKJSSmQAqqHhyqQCLkCiTApkBSTAolJ9QXy57n3RZO9o3ZvCF1fC8i+Cl0PWHyX8VLgKerUeKDEgYTOI6J+aG/L3PFQcbSgn0heoF/Y3aqJKnGuNNkxHaCe1mcFckNqXPWxeabORt0fNR5ulpIjUiBhXhRIBoqaduSzZDby/XVSgezTswNJq4pcrtNrfh1HjkiBhDlRIBkoBfLKCZylR2SqQLL5wG2ppdcbx4Gl6RbWGPclQoFkpI642GUjtwOpcFIgKS1yuU6vaQfCkAL3QRRIlhIFYgeSVcp7FLvEUmejKpkaT5Xq7XhyRG5hhXlRIBkoatqB7s8Gvh/lS/Qb9OxA0rIil+v0mnYgDClwFVIgWUoUiB1IVil2IFVOVDypNDuQMCsKJAOlQBRIVikKpMqJilcgFZIQLQWSQVcgCiSrFAVS5UTFQ0viNhw7kDArCiQDpUAUSFYpCqTKiYpXIBWSEC0FkkFXIAokqxQFUuVExUNLoh1IJSEKJKOlQBRIVikKpMqJilcgFZIQLQWSQVcgCiSrFAVS5UTFQ0uiHUglIQoko6VAFEhWKQqkyomKVyAVkhAtBZJBVyAKJKsUBVLlRMVDS6IdSCUhCiSjpUAUSFYpCqTKiYpXIBWSEC0FkkFXIAokqxQFUuVExUNLoh1IJSEKJKP12wTy57n3i4TkJM3Ih1HUwJ7C6wVh5C/RrdAvEmLf9QVOiBfo1+ioteySWqqgzmdiYD1xQ1pOzJCWlRrTYecdA+pE/uQilbxzmTdvb1UgNwxw2EJmZqoCCcyvQFJICiQkpUD4HawQfRjGrK/LokAy4M0nl72T24FkyO1AMk5s588UugJRIFn1XkWxhcwY0g4kTSPD+7IZxixCCiTLHTvvmNwpEAWSVa8CKXOyA8mQKZCMkwLJOG1RTT/6DuQWY7ewsuprFp5bWBnevSgFkrFTIBknBXLNidpxUCBZ9SmQjJNbWBmnw847ptDdwnILK5sIbmGVObmFlSGzA8k42YFknOxA7EAKlXIJ9SV6ioxqaX2JHhG3A4kwbUH+HUjOKo6k5vthC5m5QQWSVhTDe5vv3TeVH4ZqB5Llzg4k42QHYgdSqBQ7kBosBZLw8i/RE0rnhwjo6xbsQDLg5ShqvtuBZOiZd4vbtXwHkiG3A8k42YFknOxA7EAKlWIHUoNFPZG4hRVxP+yDG/OkZAfyWgXctIrKKg+iBnbYQmZu0HcgaUkxvH0HEvI+7LxTIHsZ9A8Jb9X1YQuZWdAUSLig+W28ESjfgUSYfAfyFxOzjGXQS1HUwBRIhp15MPMdSEZ7i/IdSAbLdyAZJ9+B+A6kUCm+A6nBop5IfAcScT/sgxvzpOQ7EN+BRPPgH6dxa9DiD0qN8fuDUmNGbzsJzLro74GEyH+dQJ6bv0jY/vrGHdAncJ8Zmg/oL9Fh7xvAP0bDfmmPAw79md2ynMC9ixX8YRiyzsP1ahwG5Y9CjsoffHAbg0wjIODbt0lwN9j9o/ZVgdxKPJccBZJNLmpqKZCM98ze98crKJCUOVXlCuSNOPlkxqVHgURTggNuBxIBh4Og/CmQNC8QcDuQd+AKJC0+7kWsW1gZc7ewMk4KJONEbv27hfX2Qp582k8TOYojx8Q9dVBfyKdARvm//L8CyTgpkIyTAnnjRC6K5GKdJnIUR46JZEWdC7o/ajj9X9X8lEjfgYxq++r/ofwpkJQ5BNwtLLew0pK7jrMDGVNTIGNG9HOgAkmZK5BXUhwI34Gkxec7kISUAkkosdNYgaTMuXXTdyC+A0mr7i3ODmSMTIGMGdmBFBihoQqEfXTZ/jgO2o8H99Gxl8zkz8f6h4TRVFYgEaZLELSe2YGkzCHgvgPxHUhacr4DqZFSIAVe0HqmQFLmEHAFokDSklMgNVIKpMALWs8USMocAq5AFEhacgqkRkqBFHhB65kCSZlDwBWIAklLToHUSCmQAi9oPVMgKXMIuAJRIGnJKZAaKQVS4AWtZwokZQ4BVyAKJC05BVIjpUAKvKD1TIGkzCHgCkSBpCWnQGqkFEiBF7SeKZCUOQRcgSiQtOQUSI2UAinwgtYzBZIyh4ArEAWSlpwCqZFSIAVe0HqmQFLmEPCfL5AU2DiOQ3r+OdPx9ZKI7k887p37d/9MJ5q9JDXDGHREaCFAxTkkUAig7m99KVz0UaFkJVDnOmANTKRj4idtJ6764VAqNefTKhAuL9mZ0OxllxxEoSOiFtjzmNcDLh7U/SmQsHYPWAPhyHcfjvu/iT5xVQXSh3e4+kOX6z6XqyPREVELrAJBcls7CVkJ1LkON4FrSD+u3Qpknx+6blC1t7VYU/m+w8HHuzl0RGghHC55y0Ldnx1IOLcOWAPhyO1ACqCoebU9eKIrWuEmHhJ6vJtDR4QWwgEXD+r+FEg42w5YA+HIFUgBFDWvFEgBOtReKZACc6rQFUgIXYGEoPIwdsLn1/0qkppXCqSSD2ZysfUEns2X6JViAGLB3FE/nAI9JAFwkFP4KawbGBVIWl/kJFUgKXUsjip0O5AwJUyNhxe7e5gCUSCTRaZAYoB2IDEqJpCsTepcCoTJ7dVZqNScT+nfgeDpGZwQzR4yeHRE1BP6tpd5wMWDuj87kLB2D1gD4cj3wuxA7EAmymdbFSePvz6cmVzoiKgFVoGAdZKeiqwE6lxMjacE7h2nQBTIZI1RE2vrHyfHcjkcHZECyXJiB5Jxgmo8vNjdwxSIApksMnS5nhyLAikDpASpQEL0zENSeLG7hykQBTJZZAokBug7kBgVE0jWJnUuBcLk9uosVGq2TRAoP9SD2balgt4gjn/yhMe7OXREaCFAxTmZsX8Op+7PDiTMygFrIBz5XpgdiB3IRPngbxwmx+IWVhmgAgmRUY8lCiQEnodRqbEDyZlzkWj2kGGhI6IW2M21B1w8qPuzAwlr94A1EI7cDqQAippXbmEVoEOfUFEgBeZUoSuQELoC2UCRGFbwg5fU4nEi75CapEd8iqVeOp1r6onJ3hNYnGTqsJJiMF3mMXSDK3Rz4K1h70PJh0CwNNnPqzd/ULL9DoQEoUDChxcFEoFSIBEmBZJjwj4IQ66b4HP3sigQ9gWqHUg4u+xAQlBg2w4+ptuBZOmjPkmpQF55kyDsQLIi3qKO9iJWgeTJoyaNAomYg6VpB3KDuFtYN8DYgURzlPvDG9+BhMDZ72qxA8mw24Hsc1IgCiSbQbeiwMc8X6KHqbADiUCBpWkHYgcS1dxbkB1IyAucpQokZK5AIlBgaSoQBRLVnAKpYXILq8LLdyBDWqAb/RjvkPZVgJ/CusCgCtAOJKw+8DHPDiRkThW5fwcSAue+z456hkAXu/PJFIgCiWcDGahAcprU6qFAIuZgabqF5RZWVHNuYdUwuYVV4aVAhrRAN7qFNaTtFtYnRFQBuoUVVh/4mOcWVsicKnK3sELgbmHdAuXHeG+QUSDh3FIgISj/Ej0BBbrRDiQB/jfGdyC+A6nUCxarQHKUbmENWSmQIaL3ABKWAlEghdLjQhVIzlKBDFmRayJYmr5E9yX6sHb/CXALK+QFzlLfgYTMwVXWrzLJmPtVJvucfAfiO5BsBt2KUiA5PzuQISvQjb4DGdK+CnALyy2sSr1gsQokR6lAhqwUyBCR70A+IvLr3CtFQ61ChWt+FapAcpBU6sBV1i2sLH1uYd3Ywvrz57lV1qdmy7M7DHBCcD+2iw4qq9JHRkEzYiUFAo2JqwHwo7ePzG3hWtTDG/bOEKuB7Y9cCiQGoUdcDsDb634H1KpAbhXOESuGmw/Ux0oUCJiTbziVAgmhH3E5UCCvyUOTQ1FFBxVW6QPDoCc9BfLAnN3hUgokhHrE5YBa6s4ImvdnB3KzfppEw3r89jAFkqWAnKTZFR8apUBC3EdcDsjabN6fAlEg4Qy68RIN3Gc+QVLzHUieUgUSsmousOHZe2EKxC2sXuUAR0GLtVtYQC6+8RQKJISvQHZB2YHYgYQzyA5kCtRBD1YgYWIUiAIJS+UebVHt0o+ItgPJKJPbBNkVHxqlQELcCkSBhKWiQAqg3MIqwDpgqAIJk6JAFEhYKgqkAEqBFGAdMFSBhElRIAokLBUFUgClQAqwDhiqQMKkKBAFEpaKAimAUiAFWAcMVSBhUhSIAglLRYEUQCmQAqwDhiqQMCkKRIGEpaJACqAUSAHWAUMVSJgUBaJAwlJRIAVQCqQA64ChCiRMigJRIGGpKJACKAVSgHXAUAUSJkWBKJCwVBRIAZQCKcA6YKgCCZOiQBRIWCoKpABKgRRgHTBUgYRJUSAKJCwVBVIApUAKsA4YqkDCpCiQGwJ5bv6kbcg9CSNzc8ivLgIHdYJgQadBf/OVW8y4u1sW7rebj3h/K3R/VIlTjM7rDpe5ZBXLYp6ysCiKYh5d7EbQ+keBzPDLjgUzrUDGyE/dn1fbPTW3DFGLI3l/CmRcT2SEAnmlCa6J6HQnx4UVDjgoBTLOCrnAks+xCmScO4qRHciYNRFhB0JQHJ1DgYwIbf9PLR4KJML9ypzpsKgSp2pAgeQ1MBOpQGbopcdSs+v8xgHa3odO4zuQtAYOKki3sAoJBELdwnILq15GCiRiRj192oFEuO1AckxYpAJRIPViUiARMwUSYVpIQdqBZMypKAWiQOq1pEAiZgokwqRAMkx+jDfkNBPmO5AZeumxCiQipUAiTAokw6RAQk4zYQpkhl56rAKJSCmQCJMCyTApkJDTTJgCmaGXHqtAIlIKJMKkQDJMCiTkNBOmQGbopccqkIiUAokwKZAMkwIJOc2EKZAZeumxCiQipUAiTAokw6RAQk4zYQpkhl56rAKJSCmQCJMCyTApkJDTTJgCmaGXHqtAIlIKJMKkQDJMCiTkNBOmQGbopccqkIiUAokwKZAMkwIJOc2EKZAZeumxCiQipUAiTAokw6RAQk4zYQpkhl56rAKJSCmQCJMCyTApkJDTTNj63/Of1vK2npivgd4Gv3LfDTsD4/pYajE7n/O0gqygr+OliL+Av+ayLq1S/JTyFaynF2ZI2xifoPt7oZJ3KU5kymC5A3lDt3bhw2Aif16GG9N2fz3wCuTG9FEg2bqiQDJOCiTj1FzHdk+uQDLmF0EqkAKtcagCGTM6RyiQjJMCyTg11zEFkuG9HdUEbwdiBzJVegokx+cW1phVcx1TIGO0X0c0wSsQBTJVegokx6dAxqya65gCGaNVILOMKse7hZXRUiAZJ7ewMk4KJOO0RVEv9rdz+Q6kQH4cqkDGjM4RCiTjpEAyTs11zA4kw3s7qgneLSy3sKZKT4Hk+NzCGrNqrmMKZIzWLaxZRpXj7UAyWgok42QHknFSIBknt7CuOYF/+FXA/2WoAslIKpCMkwLJOCmQjJMCUSCFSrkKhf46inr/pkDyNLqFNWalQMaM3iKoSXw+YRO870B8B1Ko2M+hCiTHp0DGrJrr2O6JoWety7mpxRr8ViNsTApkXJjVCLewMmIKJOPkFlbGSYFknFCpKZAC9DBUgWSgFEjGSYFknBRIxkmBXHPyJXpeNVBfznXk1JnOuwS9P2b6CM9v483LyW/jDVlRZe4W1uuWoF/nHlaeX+eeglIgGSm/zj3jBD1r+Q7kC9y+RL8Bxy2sbJK6hZVxcgsr4+QWVsbJLSy3sAqVchUKPVZxHTl1Jrew0oKwA8lIQVPFDsQOJCu4f5wGfkbOXyTM+LuFlXFSIBknBZJxunQzvfeP6/Of7k/a9i64d0vcmRboNez5aZh7suZGVSiIR4WCmNYTUwmnw+aOgsVwYh+tmYIj590JWw24GUxVAJ+7Xk0pkAe8A+HKj5mk6FnAGaFA0sz0Jvv+2cEEpsP/aksElL8CqSSkV1MKRIFUquxzLLj+KJA0Fb3JrkBSvp/jKOLgdAH/PP58v707VCAKpD+rtr3TucOvj1YgKcveZFcgKV8FkpJSIAokrZW7rz8KJE2FAklIuYWVUPob06spBaJAKlXmFtYULapd6032uz8BTLG5HOxL9ApEqp7cwnqjTk0tspC7+4uVUvq2WLCG7UDSLFJVDu9BpsP/Io6cd3YglYT0asoOxA6kUmV2IFO0KNv2JrsdSD95FHGqAv72a/07+nhk7w4ViAKZq0FwRtiBpKnoTXYFkvL9HEcRB6cL+wkWP4V1STqXaDLV1Kj6E+BuR4KYFEiaJbKewASmw3cLCyBFbz/2asoOxA5krpjB9UeBpKnoTXY7kJSvHUhKSoEokLRW7r7+KJA0FQokIeVL9ITS35heTSkQBVKpss+xdiAFfhSs3mS/+xNAgcStUD+FVYFI1VN/81+BKJBKxSqQKVrUhFcgSRrsQBJKdiD/UKKmFvkkxL3arxTEg2KpNXH7Rmkme34bbyX3YAIrl33Ag5sCqSSkN/fsQB5QyAokK2QFknFi60mBJNR7y+tdG3Y/xjvXPO2nnUs0ObGoUSWl/uAYEJMCSXNH1hOYwHT4X8SRnb8dSCUhvZqyA7EDqVTZXR+pFEiait5k3z+7AkmoU8RZ2uTZene4/nl+bh3ZOuhmprizrSsElRvSQj4JLctTUu9BDHWDEO9txMyYyJ8ybf7SZ8B/JoRjTv2MMPXe6QQCX1+YetoyRa0r4O8frKeXmSL659hT8/4UyK0UgLWnQNI6Z6ArkJT3+dtvIebQwqhACrlTIPxbEDuQtACZhQP9RSlqMeMe0BfwgThNTBDH3aACCXDbgdyEZAdiBxLOoFth3GLmFlaaCo65AgmZN7d47vnS0C2sN7rU0/B5qxKaXNyQfAcSzlEFkoKCanz7IChT6L4D+YbcuYXlFlZadu9xvkQfMfMdyIjQ+/8rkJAV9WAKvSvadtUUiAIJy/cqTIGMmCmQESEFkhN6jVQgu8h8B+I7kPJc+vcAbjvFLaw0FRxzO5CQuQJRIGGpXMKYreHXU4En8+9Ahmm0AxkiegtQICErBaJAwlJRICVQ3NMwZW0FkidQgYSsFIgCCUtFgZRAKZASLiSYY65AwoQoEAUSlooCKYHiFjM7kBQ8x1yBhMwViAIJS0VMShamAAANo0lEQVSBlEBxi5kCScFzzBVIyFyBKJCwVBRICRS3mCmQFDzHXIGEzBWIAglLRYGUQHGLmQJJwXPMFUjIXIEokLBUFEgJFLeYKZAUPMdcgYTMFYgCCUtFgZRAcYuZAknBc8wVSMhcgSiQsFQUSAkUt5gpkBQ8x1yBhMwVyL5Anp//NP9MunnY3jBO4LnWo31X1PmGwfvDvowNGhPGe1kW6hfkuPU1XF3CMOjHRdDpAv3VJYX8RE1fetpR8w6qga3ioCk8c6pVgdya/GB2yExThUyNSYGE9ti+PjWP/SJSgYQYGdyvF4MUCdWAArmuAXRGUI8wZPWR54IKWYGEqxAYBi0e6HSxAwkTDM07qAYUiAIJC/djGFTICqTJf+IwaPFQIGEOyOc2qvOHakCBKJBwFiiQMijKseULDw6AFg8FEiZGgYSg+q9TfAdyEzFZfeS5qNURGpPvQOJJ6juQMSpfoo8ZvUVAU/h8vu6pFIgCKVTsTqgCyfnZgQxZKZAhoveA7qq/c4nuqRSIAilUrAKZgqVAhvgUyBCRAvmECN3U9VNYWQl2nzk+nN0OJMN9jlIgQ1YKZIhIgSiQQpF8CvUdyJAehWh4oWKAAhkCUyBDRApEgRSKRIHUYSmQmNnq34GErKCigh4itkFDmwgzp/IdyM3yAbNDZpr6PDo1JrewwgXILawElB1IQuk1BlyiuqdSIAqkULE7oQok5wc9faKvDO1AwvzZgeyBUiAKJJxAN8IUSM5PgQxZ2YEMEfkOxHcghSLxHUgdFvSwWL/w4AgFMkSqQIaIFIgCKRSJAqnDUiAxM1+ip6igooIeIrZRd19c7Nxy91RuYbmFlc6g/Ti3sHJ+0OLhO5AQeXdV3D29AvEdSFh3lzCy+shzQYVM3Z8CyatKgQxZuYU1ROQWlltYhSJxC6sOi3Js/cpfH6FAhkQVyBDR0QTyTD4eF+7+PZSc799+My0ClYMYWtxvYZPEmXvD/lSG+9MNuKeFOJ3vD5MaMyaqLuk9hMoM/TL2gNNl5t7W52cFMgPw8ccea6KeqK2wDSRzb9RpthGBE547FcRJgTx++nJFgE2XGQgKZIbetxzLLB7Uk54CyYuAWzuYGtgECRnyhP1BIkeJO1Oe42EkOSiuDIbDvhWgQNrovutApmoUSJY/aH11CyvDvVB16RZWCHwyTIFMAnz84QpkyJxBdNlUA58YuVNxN2gHMqwmNoArArew/maGmw7sh2/ZyqHOxtCinvTcwsrzyq0dTA24hZXnDovkikCBKJBOWTKLhwLJ2NuBZJx8B5JxOuJnTsKR74a5hTVD71uOVSBD7Awit7CGoN8DFEgIyw4kBFUIA+c7KvjCLTwwlKFlB5KlzA4k46RAMk7oAsUsBeHA98PsQKbwfcfBTNUokCx3CiTjpEAyTgok5FQJY5bEyxXJDrFyD4+LZWgpkCxjCiTjpEAyTugCxSwF4cDtQKZAHedgpmoUSJZRBZJxUiAZJwUScqqEMUuiHUiNOdOr+THenDpD/Hw9bsb4dyB5/pBIrgjIMmjfmu9A2ui+60Bm8bADyfJnB5JxsgPJONmBhJwqYcySaAdSY848CtmB5NQZ4nYgKXGOd3rFII4cFLlwBkPfC7EDaYL7vsOYqrEDyTJoB5JxsgPJONmBhJwqYcySaAdSY848CtmB5NQZ4nYgKXGOd3rFII4cFLlwBkO3A2lCOtZhTNXYgWRZtQPJONmBZJzsQEJOlTBmSbQDqTFnHoXsQHLqDHE7kJQ4xzu9YhBHDopcOIOh73Ygf5q/SHhUDti4sBNxP9pzTuBpharmpVkxHw6DfkdoOyt0Z8d9yKNgkW0RUwbYWcBph9UTW5tUlZ//aJqj1R3VqkBu1D6XG+xX3xRItk6BqUMXoUWBDBN41Nx1F9iPN3wCK0qBvNKlkrMtsMMSDQOwE9mBhMSxqQWmDhvTxkCBDEvhqLmj1igF8loCR000Ni7sRApkuGrADxJg6hRImjwo7qi5UyD7CXYL61bhg5VMfV2EW1jZKgWmToFkyLGoo+ZOgSiQWpGDlaxAMvTcJM2ul0RRY3ILK6ENbkGDH8rwJfrt3NmB2IFkM/tGFLWtz07SqVv652AFwrFMzgQ+t6HdI1UHvgPxHUgyD/5dhMCPXfox3jH+oy5CvkT/ublTIG5hjav3OgJchdzCytBzkzS7XhJFjcktrIS2W1gZpUuUH+N9pUVOUmzdx07kp7DSSUHVAZg6dBvEDmRcCUfNHVeb1JkUyFs1cUjBJxiwku1AxguH70AyRlsUuCVauOpDQsFph8qfWqN8B+I7kPJEUiAZMm6SZtdLoqgxuYWV0AYfAP0UVgZ8chfIT2Hdwgw+CimQrJapxRpMHfoU6xbWuA6OmjuuNqkzuYXlFtZ4Pn2K8FNYY2hHXYQUyM/NHbXsu4XlFtZ4FnyIsAPJkHGTNLteEkWNyS2shLZbWBmlS5Sfwprcf9uDjT19YifyU1jppKAWazB1bmGlyYPijpo7rjapMykQt7Aak84trDG0oy5CbmH93NxRy75bWG5hjWeBW1hlRucDuEnauvzuQdSY3MLKcnJU+VN18OsE8vzfcy9nT1lBPDwK+qW9hby/HuGHo2tdkPqFxO3PG5jkkZOU09pl1/po/6h99CdI/1iHfQb9AvKmDEIWAHh73fStCuRGRhVIVuoKJOP0+tqzEPyQUAUSYlYg+x26AlEg4RTaD1MgBXzkI2Phsl+EKpCQowJRIGGpXMLsQDJcCiTjZAcScXILK8J0CSKfR5qCdAvrVr4USFbJCiTjhM/4wmXtQOZhNRfY+Qt/mTzu9M37UyAKZK4IFUiBH/nIWLisApmH1Vxg5y+sQO7K8NPJmQ/yuIWVZk2BpKTgPYfCZRXIPCwFssvQDsQOZG5yKZACPzuQESzfgYwIXf0/WU5NQSoQBVKo2J1QBVLgR874wmXtQOZhNRfY+Qu7hXVXhm5hPRbvp6spkEICFMgIlh3IiJAdSIFQI9R3IA1oE4cokAI8BTKCpUBGhBRIgVAjVIE0oE0cokAK8BTICJYCGRFSIAVCjVAF0oA2cYgCKcBTICNYCmRESIEUCDVCFUgD2sQhCqQAT4GMYCmQESEFUiDUCFUgDWgThyiQAjwFMoKlQEaEFEiBUCNUgTSgTRyiQArwFMgIlgIZEVIgBUKNUAXSgDZxiAIpwFMgI1gKZERIgRQINUIVSAPaxCEKpABPgYxgKZARIQVSINQIVSANaBOHKJACPAUygqVARoQOJpD/nns/abuSc8GvCShUDQWLTGBh+D8slKSEufZEjgr63QJoQVjBezuRP+oD/dzy8kTN3/NPQHPnOjXztyqQGysaOUe5PJ9/ORxagskbhIZ0wNOQlBTIOMEKZMzob4QCeSORQ3tYJLpykKNWICTN0bnQMsBSR47KDmRUA9v/24HsYrIDuVU95BylFo5trNTJyBuMpuCPDCIp2YGMS8AOZMzIDuQjI2pNzNmPI9GVY3y5PIKCRd5gPvqfFklSUiDj7CuQMSMFokDyKvkUqUAm4JUPVSAhsuZL2E9LgS/RQ+C+RH8HRa2JMfogEF05guvFIRQs8gbjwf+4QJKSHcg4/XYgY0Z2IHYgeZXYgUywmj9UgYQM7UAyUH6M98IJqpfXk2XsHxqFrhzkyO1ASJqjc6FlgKWOHJWfwhrVwPb/fgprF5OfwrpVPeQcpRaOi7qjeh8HkTc4vtpPjSApuYU1rgK3sMaM3MJyCyuvErewJljNH6pAQobQloQCCXlvu0DUw+Sy+JfoOfcsEl05sktmUVTRkDeYjfwnRpGU7EDGFaBAxozsQOxA8iqxA5lgNX+oAgkZ2oFkoHyJfuEE1cvryTL2D41CVw5y5HYgJM3RudAywFJHjsqX6KMa2P7fl+i7mHyJfqt6yDlKLRwXdUf1Pg4ib3B8tZ8aQVJyC2tcBW5hjRm5heUWVl4lbmFNsJo/VIGEDKEtCQUS8vYl+hUo6qE6Zz+ORFeO8eXyCAoWeYP56H9aJEnJDmScfQUyZmQHYgeSV4kdyASr+UMVSMjQDiQD5Uv0CyeoXl5PlrF/aBS6cpAjtwMhaY7OhZYBljpyVL5EH9XA9v++RN/FtD53f9I2op4FnbAXw1ums4s+MopaOLZX6Mz9vUB/hATeGpcRclAQp8vNMbnjQC3LCbq/FXqiJFP3AoIixwUOiztVsw4UCJeC22cCq0+BBAkDeS/NibU/SgUyyh6ZOgUyon31/806VyAFxu1QcFYokCALIG8FEvA+d8Z2IBmoo0YpkL+ZOd5THrlDp0CCGahAAkivm2rNhePjBRRIjPyYgc06sAN5RDrBBU2BBAkDeduBBLztQDJIR45SIHYglfr0JXpIqzmxfAcS8v0QRrrfdyCFHDTr3A6kwLgdCs4KO5AgCyBvO5CAtx1IBunIUQrEDqRSn3YgIa3mxLIDCfnagfRA0Uc169wOhE7E3vnAJ2I7kCBhIG87kIC3HUgG6chRCsQOpFKfdiAhrebEsgMJ+dqB9EDRRzXr3A6EToQdyCOIfn0NO5A4B/4leoaKLKnsig+OUiB2IJWSswMJaTUnlh1IyNcOpAeKPqpZ53YgdCLsQB5B1A4EomwHkoG0A9nnpECy+pmLAqvPl+hBKkDevkQPePsSPYN05KhmB/I/MmisOWxTr+MAAAAASUVORK5CYII=';

module(
  'Integration | Component | common/image-upload-action/image-editor',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      this.set('image', imageDataUri);
      this.set('isOpen', true);
      this.set('onClose', () => {
        this.set('isOpen', false);
      });
      this.set('width', 400);
      this.set('height', 400);
      this.set('fileType', 'image/png');
      this.set('saveImageEditData', () => {});

      await render(hbs`
      <Common::ImageUploadAction::ImageEditor
        @isOpen={{this.isOpen}}
        @onClose={{this.onClose}}
        @image={{this.image}}
        @width={{this.width}}
        @height={{this.height}}
        @fileType={{this.fileType}}
        @saveImageEditData={{this.saveImageEditData}}
        as |preview|
      >
        {{!-- template-lint-disable no-inline-styles --}}
        <img data-test-image-editor-preview style="width:30px;height:30px;" src={{preview}} alt="" role="presentation"/>
      </Common::ImageUploadAction::ImageEditor>
    `);
    });

    test('it is shown when isOpen is truthy', async function (assert) {
      assert.dom(IMAGE_EDITOR_ROOT).isVisible();
      this.set('isOpen', false);
      assert.dom(IMAGE_EDITOR_ROOT).doesNotExist();
    });

    test('it can be closed by clicking the cancel button', async function (assert) {
      assert.dom(IMAGE_EDITOR_ROOT).isVisible();
      await click(CANCEL_BUTTON);
      assert.dom(IMAGE_EDITOR_ROOT).doesNotExist();
    });

    test('it can edit an image, preview it, and save it', async function (assert) {
      let result: {
        preview: string;
        file: Blob;
      };

      this.set('saveImageEditData', (data: { preview: string; file: Blob }) => {
        result = data;
      });

      await click(ROTATE_CCW_BUTTON);

      assert.dom(PREVIEW).hasAttribute('src', rotatedAndCroppedImageDataUri);

      await click(SAVE_BUTTON);

      assert.strictEqual(result!.preview, rotatedAndCroppedImageDataUri);
      assert.strictEqual(result!.file.type, 'image/png');
    });

    test('it throws an error when width and height are not provided', async function (assert) {
      await render(hbs`
      <Common::ImageUploadAction::ImageEditor
        @isOpen={{this.isOpen}}
        @onClose={{this.onClose}}
        @image={{this.image}}
        @fileType={{this.fileType}}
        @saveImageEditData={{this.saveImageEditData}}
        as |preview|
      >
        {{!-- template-lint-disable no-inline-styles --}}
        <img data-test-image-editor-preview style="width:30px;height:30px;" src={{preview}} alt="" role="presentation"/>
      </Common::ImageUploadAction::ImageEditor>
    `);

      assert
        .dom(IMAGE_EDITOR_ERROR_OVERLAY)
        .containsText('Sorry, an unexpected error occurred.');

      assert.dom(IMAGE_EDITOR_ERRORED_EXIT_BUTTON).containsText('Exit');

      await click(IMAGE_EDITOR_ERRORED_EXIT_BUTTON);

      assert.dom(IMAGE_EDITOR_ROOT).doesNotExist();
    });
  }
);
