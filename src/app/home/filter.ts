import { Marvin, MarvinImage } from 'marvin';

export abstract class Filter {
  name: string;
  constructor(name: string) { this.name = name; }
  abstract applyFilter(img1: MarvinImage, img2: MarvinImage): MarvinImage;
}

export class GrayScaleFilter extends Filter {
  applyFilter(img1: MarvinImage, img2: MarvinImage){
    Marvin.grayScale(img1, img2);
    return img2;
  }
}

