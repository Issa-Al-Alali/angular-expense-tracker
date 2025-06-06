// src/app/videos/videos.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideosComponent } from './videos.component';
describe('VideosComponent', () => {
  let component: VideosComponent;
  let fixture: ComponentFixture<VideosComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideosComponent]
    })
    .compileComponents();
    fixture = TestBed.createComponent(VideosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});