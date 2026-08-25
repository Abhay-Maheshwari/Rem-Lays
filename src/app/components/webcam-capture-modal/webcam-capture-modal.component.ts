import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-webcam-capture-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './webcam-capture-modal.component.html',
  styleUrl: './webcam-capture-modal.component.scss'
})
export class WebcamCaptureModalComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  
  @Output() cancel = new EventEmitter<void>();
  @Output() capture = new EventEmitter<File>();

  stream: MediaStream | null = null;
  photoDataUrl: string | null = null;
  error: string | null = null;

  ngOnInit() {
    this.startCamera();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
      }
    } catch (err: any) {
      this.error = 'Could not access the camera. Please check permissions.';
      console.error('Webcam error:', err);
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  takePhoto() {
    if (!this.videoElement || !this.canvasElement) return;
    
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    
    // Set canvas dimensions to match the video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      this.stopCamera();
    }
  }

  retake() {
    this.photoDataUrl = null;
    this.startCamera();
  }

  confirm() {
    if (!this.photoDataUrl) return;
    
    // Convert data URL to File
    const parts = this.photoDataUrl.split(',');
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    const file = new File([u8arr], `Webcam_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, { type: 'image/jpeg' });
    this.capture.emit(file);
  }

  onCancel() {
    this.cancel.emit();
  }
}
