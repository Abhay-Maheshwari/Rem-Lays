import { TestBed } from '@angular/core/testing';

import { ItemViewerService } from './item-viewer.service';

describe('ItemViewerService', () => {
  let service: ItemViewerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItemViewerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
