import { Component, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { ToastService } from '../../services/toast.service';
import { AppComponent } from '../../app.component';

@Component({
  selector: 'app-write-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputComponent],
  templateUrl: './write-page.component.html',
  styleUrl: './write-page.component.scss'
})
export class WritePageComponent implements AfterViewInit {
  @ViewChild('titleInput') titleInput!: ElementRef<HTMLInputElement>;
  @ViewChild('noteInput') noteInput!: ElementRef<HTMLTextAreaElement>;
  
  titleContent = signal('');
  noteContent = signal('');
  tags = signal<string[]>([]);
  isSaving = signal(false);

  constructor(
    private itemsSvc: ItemsService,
    private toast: ToastService,
    private app: AppComponent
  ) {}

  ngAfterViewInit() {
    // Auto-focus the title input when the page loads
    setTimeout(() => {
      this.titleInput?.nativeElement.focus();
    }, 100);
  }

  onTitleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.titleContent.set(target.value);
  }

  onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.noteContent.set(target.value);
  }

  async saveNote() {
    const title = this.titleContent().trim();
    const body = this.noteContent().trim();
    
    if (!title && !body) {
      this.toast.show('Note is empty', 'error');
      return;
    }

    const fullText = title ? (body ? `${title}\n\n${body}` : title) : body;

    this.isSaving.set(true);
    try {
      await this.itemsSvc.addText(fullText, this.tags().length > 0 ? this.tags() : undefined);
      this.toast.show('Note saved successfully', 'success');
      
      // Reset form
      this.titleContent.set('');
      this.noteContent.set('');
      this.tags.set([]);
      
      if (this.titleInput?.nativeElement) {
        this.titleInput.nativeElement.value = '';
        this.titleInput.nativeElement.focus();
      }
      if (this.noteInput?.nativeElement) {
        this.noteInput.nativeElement.value = '';
      }
    } catch (e) {
      this.toast.show('Failed to save note', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.saveNote();
    }
  }

  goBack() {
    this.app.activeView.set('home');
  }
}
