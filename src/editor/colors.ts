/** A document palette: greys, then saturated hues, then tints and shades. */
export const PALETTE: string[][] = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#cc4125', '#dd7e6b', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
]

/** Highlighters read better as tints; the full palette is overkill here. */
export const HIGHLIGHTS: string[][] = [
  ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff9900'],
  ['#fff2cc', '#d9ead3', '#d0e0e3', '#ead1dc', '#fce5cd'],
]
