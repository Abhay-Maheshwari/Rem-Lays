import { Component, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuService, MenuItem } from '../../services/context-menu.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.scss'
})
export class ContextMenuComponent {
  @ViewChild('menu') menuRef?: ElementRef;

  constructor(public contextMenuSvc: ContextMenuService, private sanitizer: DomSanitizer) {}

  get x() {
    const pos = this.contextMenuSvc.position();
    let width = 280; // fallback width for longer text
    if (this.menuRef && this.menuRef.nativeElement.offsetWidth > 0) {
      width = this.menuRef.nativeElement.offsetWidth;
    }
    if (pos.x + width > window.innerWidth) {
      return Math.max(8, window.innerWidth - width - 8);
    }
    return pos.x;
  }

  get y() {
    const pos = this.contextMenuSvc.position();
    let height = 250; // fallback height
    if (this.menuRef && this.menuRef.nativeElement.offsetHeight > 0) {
      height = this.menuRef.nativeElement.offsetHeight;
    }
    if (pos.y + height > window.innerHeight) {
      return Math.max(8, window.innerHeight - height - 8);
    }
    return pos.y;
  }

  @HostListener('document:click', ['$event'])
  @HostListener('document:contextmenu', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // If default was prevented, it means an item card (or another component) 
    // handled the right-click to OPEN the menu. Don't close it instantly.
    if (event.defaultPrevented && event.type === 'contextmenu') {
      return;
    }
    if (this.contextMenuSvc.isOpen()) {
      this.contextMenuSvc.close();
    }
  }

  getSafeIcon(iconSvg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(iconSvg);
  }

  onItemClick(event: MouseEvent, item: MenuItem) {
    event.stopPropagation();
    item.action(event);
    if (!item.keepOpen) {
      this.contextMenuSvc.close();
    }
  }
}
