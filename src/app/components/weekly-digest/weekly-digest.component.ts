import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-weekly-digest',
  standalone: true,
  imports: [CommonModule, ItemCardComponent],
  templateUrl: './weekly-digest.component.html',
  styleUrl: './weekly-digest.component.scss'
})
export class WeeklyDigestComponent {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();

  constructor(private itemsSvc: ItemsService) {}

  recentItems = computed(() => {
    const all = this.itemsSvc.items();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Sort descending by created_at so newest is first in the list
    return all
      .filter(i => new Date(i.created_at) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  stats = computed(() => {
    const items = this.recentItems();
    let notes = 0, links = 0, images = 0, videos = 0;
    const daysCount: Record<string, number> = {};

    items.forEach(i => {
      if (i.type === 'text') notes++;
      else if (i.type === 'link') links++;
      else if (i.type === 'image') images++;
      else if (i.type === 'video' || i.type === 'reel') videos++;
      
      const day = new Date(i.created_at).toLocaleDateString('en-US', { weekday: 'long' });
      daysCount[day] = (daysCount[day] || 0) + 1;
    });

    let busiestDay = 'None';
    let maxCount = 0;
    for (const [day, count] of Object.entries(daysCount)) {
      if (count > maxCount) {
        maxCount = count;
        busiestDay = day;
      }
    }

    let headline = 'You had a quiet week.';
    if (items.length > 5) {
      if (notes > links && notes > images) headline = 'Lots of thoughts! Mostly notes this week.';
      else if (links > notes && links > images) headline = 'Deep dive! You saved a lot of links this week.';
      else if (images > notes && images > links) headline = 'A very visual week! Mostly media.';
      else headline = `Your busiest day was ${busiestDay}, with ${maxCount} items saved.`;
    } else if (items.length > 0) {
       headline = `Your busiest day was ${busiestDay}.`;
    }

    return {
      total: items.length,
      notes,
      links,
      images,
      videos,
      busiestDay,
      headline
    };
  });
}
