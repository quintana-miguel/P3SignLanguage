import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';
import { ActionSheetController, ToastController, Platform, LoadingController } from '@ionic/angular';
import { File, FileEntry } from '@ionic-native/file/ngx';
import { HttpClient } from '@angular/common/http';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { Storage } from '@ionic/storage';
import { FilePath } from '@ionic-native/file-path/ngx';

import { finalize } from 'rxjs/operators';

import { Marvin, MarvinImage } from 'marvin';
import { Filter, GrayScaleFilter } from './filter';
import { Base64 } from '@ionic-native/base64/ngx';

import { Device } from '@ionic-native/device/ngx';

const STORAGE_KEY = 'my_images';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  images = [];

  filters: Filter[] = [];  // filters to bind in the list
  workImg: MarvinImage;
  outputImg: MarvinImage;

  constructor(
    private camera: Camera, 
    private file: File, 
    private http: HttpClient, 
    private webview: WebView,
    private actionSheetController: ActionSheetController, 
    private toastController: ToastController,
    private storage: Storage, 
    private plt: Platform, 
    private loadingController: LoadingController,
    private ref: ChangeDetectorRef, 
    private filePath: FilePath,
    private device: Device
  ) {}

  ngOnInit() {
    this.plt.ready().then(() => {
      this.loadStoredImages();
    });
    this.setupFilters();
  }

  setupFilters(){
    this.filters.push(new GrayScaleFilter("GrayScale"));
  }

  loadStoredImages() {
    this.storage.get(STORAGE_KEY).then(images => {
      if (images) {
        let arr = JSON.parse(images);
        this.images = [];
        for (let img of arr) {
          let filePath = this.file.dataDirectory + img;
          let resPath = this.pathForImage(filePath);
          this.images.push({ name: img, path: resPath, filePath: filePath });
        }
      }
    });
  }

  pathForImage(img) {
    if (img === null) {
      return '';
    } else {
      let converted = this.webview.convertFileSrc(img);
      return converted;
    }
  }

  async presentToast(text) {
    const toast = await this.toastController.create({
        message: text,
        position: 'bottom',
        duration: 3000
    });
    toast.present();
  }

  async selectImage() {
    const actionSheet = await this.actionSheetController.create({
        header: "Select Image source",
        buttons: [{
                text: 'Load from Library',
                handler: () => {
                    this.takePicture(this.camera.PictureSourceType.PHOTOLIBRARY);
                }
            },
            {
                text: 'Use Camera',
                handler: () => {
                    this.takePicture(this.camera.PictureSourceType.CAMERA);
                }
            },
            {
                text: 'Cancel',
                role: 'cancel'
            }
        ]
    });
    await actionSheet.present();
  }
  takePicture(sourceType: PictureSourceType) {
    var options: CameraOptions = {
        quality: 100,
        sourceType: sourceType,
        saveToPhotoAlbum: false,
        correctOrientation: true
    };

    this.camera.getPicture(options).then(imagePath => {
        if (this.plt.is('android') && sourceType === this.camera.PictureSourceType.PHOTOLIBRARY) {
            this.filePath.resolveNativePath(imagePath)
                .then(filePath => {
                    let correctPath = filePath.substr(0, filePath.lastIndexOf('/') + 1);
                    let currentName = imagePath.substring(imagePath.lastIndexOf('/') + 1, imagePath.lastIndexOf('?'));
                    this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
                });
        } else if (this.device.platform == "browser"){
            console.log("Platform: Browser");
            this.copyFileToLocalDirBrowser(imagePath, this.createFileName());
        } else {
            var currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
            var correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
            this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
        }
    });
  }

  createFileName() {
    var d = new Date(),
        n = d.getTime(),
        newFileName = n + ".jpg";
    return newFileName;
  }

  copyFileToLocalDir(namePath, currentName, newFileName) {
    this.file.copyFile(namePath, currentName, this.file.dataDirectory, newFileName).then(success => {
        this.updateStoredImages(newFileName);
    }, error => {
        this.presentToast('Error while storing file.');
    });
  }

  copyFileToLocalDirBrowser(imageData, newFileName) {
    console.log("imageData: " + imageData);
    console.log("newFileName: " + newFileName);
    console.log(imageData.slice(0,23));
    if (imageData.slice(0,23) != 'data:image/jpeg;base64,'){
	imageData = 'data:image/jpeg;base64,' + imageData
    }
    this.storage.get(STORAGE_KEY).then(images => {
	let arr = JSON.parse(images);
	if (!arr) {
	    let newImages = [newFileName];
	    this.storage.set(STORAGE_KEY, JSON.stringify(newImages));
	} else {
	    arr.push(name);
	    this.storage.set(STORAGE_KEY, JSON.stringify(arr));
	}

	let filePath = undefined;
	let resPath = imageData;

	let newEntry = {
	    name: newFileName,
	    path: resPath,
	    filePath: filePath
	};

	this.images = [newEntry, ...this.images];
	this.ref.detectChanges(); // trigger change detection cycle
    });
  }

  updateStoredImages(name) {
    this.storage.get(STORAGE_KEY).then(images => {
        let arr = JSON.parse(images);
        if (!arr) {
            let newImages = [name];
            this.storage.set(STORAGE_KEY, JSON.stringify(newImages));
        } else {
            arr.push(name);
            this.storage.set(STORAGE_KEY, JSON.stringify(arr));
        }

        let filePath = this.file.dataDirectory + name;
        let resPath = this.pathForImage(filePath);

        let newEntry = {
            name: name,
            path: resPath,
            filePath: filePath
        };

        this.images = [newEntry, ...this.images];
        this.ref.detectChanges(); // trigger change detection cycle
    });
  }

  deleteImage(imgEntry, position) {
    this.images.splice(position, 1);

    this.storage.get(STORAGE_KEY).then(images => {
        let arr = JSON.parse(images);
        let filtered = arr.filter(name => name != imgEntry.name);
        this.storage.set(STORAGE_KEY, JSON.stringify(filtered));

        var correctPath = imgEntry.filePath.substr(0, imgEntry.filePath.lastIndexOf('/') + 1);

        this.file.removeFile(correctPath, imgEntry.name).then(res => {
            this.presentToast('File removed.');
        });
    });
  }

  async startUpload(imgEntry) {
    const loading = await this.loadingController.create({
        message: 'processing image...',
    });
    await loading.present();
    this.loadImage(imgEntry.path);
    console.log(this.workImg.image.src);
    console.log(this.workImg.image.width);
    console.log(this.workImg.image.height);
    this.callbackImageLoaded(this.workImg);
    console.log(this.workImg.canvas.width);
    console.log(this.workImg.canvas.height);
    console.log(this.workImg);
    this.outputImg = this.workImg.clone();
    this.outputImg.canvas.getContext("2d").putImageData(this.outputImg.imageData, 0,0);
    this.filters[0].applyFilter(this.workImg, this.outputImg);
    this.outputImg.canvas.getContext("2d").putImageData(this.outputImg.imageData, 0,0);
    console.log(this.outputImg);
    let img = this.outputImg.canvas.toDataURL('image/jpeg', 1.0);
    console.log(img);
    
    if (this.device.platform == "browser"){
        console.log("Platform: Browser");
        this.copyFileToLocalDirBrowser(img, this.createFileName());
    } else {
	loading.dismiss();
	this.file.resolveLocalFilesystemUrl(imgEntry.filePath)
	    .then(entry => {
		( < FileEntry > entry).file(file => this.readFile(file))
	    })
	    .catch(err => {
		this.presentToast('Error while reading file.');
	    });
    }
    loading.dismiss();


  }
  
  readFile(file: any) {
    const reader = new FileReader();
    reader.onload = () => {
        const formData = new FormData();
        const imgBlob = new Blob([reader.result], {
            type: file.type
        });
        formData.append('file', imgBlob, file.name);
        this.uploadImageData(formData);
    };
    reader.readAsArrayBuffer(file);
  }

  async uploadImageData(formData: FormData) {
    const loading = await this.loadingController.create({
        message: 'uploading image...',
    });
    await loading.present();

//    this.http.post("http://localhost:8888/upload.php", formData)
//        .pipe(
//            finalize(() => {
//                loading.dismiss();
//            })
//        )
//        .subscribe(res => {
//            if (res['success']) {
//                this.presentToast('File upload complete.')
//            } else {
//                this.presentToast('File upload failed.')
//            }
//        });
    loading.dismiss();
  }

  refreshCanvas(image: MarvinImage) {
    image.draw(document.getElementById("canvas"));
  }

  loadImage(imageSrc){
    this.workImg = new MarvinImage();
    this.workImg.load(imageSrc, function(){
      //self.refreshCanvas(this);
      // create an empty MarvinImage with the same dimesions of the originalImg
      //this.outputImg = new MarvinImage(this.getWidth(), this.getHeight());
    });
  }

  callbackImageLoaded(marvinImage){
    marvinImage.width = marvinImage.image.width;
    marvinImage.height = marvinImage.image.height;
    marvinImage.canvas = document.createElement('canvas');
    marvinImage.canvas.width = marvinImage.image.width;
    marvinImage.canvas.height = marvinImage.image.height;


    marvinImage.ctx = marvinImage.canvas.getContext("2d");
    marvinImage.ctx.drawImage(marvinImage.image, 0, 0);

    marvinImage.imageData = marvinImage.ctx.getImageData(0, 0, marvinImage.getWidth(), marvinImage.getHeight());

    if(marvinImage.onload!=null){
      marvinImage.onload();
    }
  }



}
