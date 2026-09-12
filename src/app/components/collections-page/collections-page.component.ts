import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { AppComponent } from '../../app.component';

@Component({
  selector: 'app-collections-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collections-page.component.html',
  styleUrl: './collections-page.component.scss'
})
export class CollectionsPageComponent {
  untaggedCount = computed(() => {
    return this.itemsSvc.items().filter((i) => {
      if (i.status === 'deleted' || i.status === 'archived') return false;
      const tags = (i.payload as any)?.tags;
      return !tags || (Array.isArray(tags) && tags.length === 0);
    }).length;
  });

  globalTagCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of this.itemsSvc.items()) {
      if (item.status === 'deleted' || item.status === 'archived') continue;
      if (item.payload?.['tags'] && Array.isArray(item.payload['tags'])) {
        for (const tag of item.payload['tags']) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }
    return counts;
  });

  globalTags = computed(() => {
    const counts = this.globalTagCounts();
    const tagArray = Array.from(counts.keys());
    return tagArray.sort((a, b) => {
      const countDiff = (counts.get(b) || 0) - (counts.get(a) || 0);
      return countDiff !== 0 ? countDiff : a.localeCompare(b);
    });
  });

  constructor(public itemsSvc: ItemsService, private app: AppComponent) {}

  getFolderStyles(tag: string) {
    const accent = this.itemsSvc.getTagColor(tag);
    const bg = accent.replace('hsl(', 'hsla(').replace(')', ', 0.1)');
    return {
      '--folder-bg': bg,
      '--folder-accent': accent
    };
  }

  openTag(tag: string | null) {
    if (tag) {
      this.itemsSvc.selectedTags.set(new Set([tag]));
      this.itemsSvc.filter.set('all');
    } else {
      this.itemsSvc.selectedTags.set(new Set());
      this.itemsSvc.filter.set('untagged');
    }
    this.app.activeView.set('feed');
  }

  reviewUnseen() {
    this.itemsSvc.filter.set('unseen');
    this.app.activeView.set('feed');
  }
}
