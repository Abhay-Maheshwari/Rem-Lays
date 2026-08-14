import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';

@Component({
  selector: 'app-tag-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.scss'
})
export class TagInputComponent {
  @Input() tags: string[] = [];
  @Output() tagsChange = new EventEmitter<string[]>();
  
  @Input() placeholder = 'Add tags...';
  @Input() disabled = false;
  @Input() autoFocus = false;

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

  inputValue = signal('');
  showDropdown = signal(false);
  selectedIndex = signal(0);

  constructor(public itemsSvc: ItemsService) {}

  suggestions = computed(() => {
    const query = this.inputValue().trim().toLowerCase();
    const all = this.itemsSvc.allTags();
    if (!query) return [];
    
    return all.filter(t => 
      t.toLowerCase().includes(query) && 
      !this.tags.some(existing => existing.toLowerCase() === t.toLowerCase())
    ).slice(0, 5); // Max 5 suggestions
  });

  onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.inputValue.set(target.value);
    this.showDropdown.set(this.suggestions().length > 0);
    this.selectedIndex.set(0);
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.disabled) return;

    if (event.key === 'ArrowDown') {
      if (this.showDropdown() && this.suggestions().length > 0) {
        event.preventDefault();
        this.selectedIndex.update(i => (i + 1) % this.suggestions().length);
      }
    } else if (event.key === 'ArrowUp') {
      if (this.showDropdown() && this.suggestions().length > 0) {
        event.preventDefault();
        this.selectedIndex.update(i => (i - 1 + this.suggestions().length) % this.suggestions().length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showDropdown() && this.suggestions().length > 0) {
        this.addTag(this.suggestions()[this.selectedIndex()]);
      } else {
        this.addTag(this.inputValue());
      }
    } else if (event.key === ',') { 
      // Comma confirms
      event.preventDefault();
      this.addTag(this.inputValue());
    } else if (event.key === 'Backspace' && this.inputValue() === '') {
      // Remove last tag on backspace if input is empty
      if (this.tags.length > 0) {
        this.removeTag(this.tags.length - 1);
      }
    } else if (event.key === 'Escape') {
      this.showDropdown.set(false);
    }
  }

  addTag(value: string) {
    let clean = value.trim().replace(/^#/, '');
    if (clean.endsWith(',')) clean = clean.slice(0, -1).trim();
    if (!clean) return;

    if (!this.tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      this.tags = [...this.tags, clean];
      this.tagsChange.emit(this.tags);
    }
    
    this.inputValue.set('');
    this.showDropdown.set(false);
    this.selectedIndex.set(0);
    
    // Focus input back if we clicked a suggestion
    if (this.inputEl) {
      this.inputEl.nativeElement.focus();
    }
  }

  removeTag(index: number) {
    if (this.disabled) return;
    this.tags = this.tags.filter((_, i) => i !== index);
    this.tagsChange.emit(this.tags);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.inputEl) return;
    // Simple check if clicked outside
    const clickedInside = (event.target as HTMLElement).closest('.tag-input-container');
    if (!clickedInside) {
      this.showDropdown.set(false);
    }
  }
}
