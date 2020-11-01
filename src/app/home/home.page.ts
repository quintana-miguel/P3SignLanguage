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

import { Device } from '@ionic-native/device/ngx';

import * as tf from '@tensorflow/tfjs';

const STORAGE_KEY = 'my_images';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  images = [];

  workImg: MarvinImage;
  outputImg: MarvinImage;

  model: any;

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
    this.model = tf.loadLayersModel('./assets/model.json');
    //console.log(this.model.summary());
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
//            console.log("Platform: Browser");
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
//    console.log("imageData: " + imageData);
//    console.log("newFileName: " + newFileName);
//    console.log(imageData.slice(0,23));
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
//    await loading.present();

    this.model = await tf.loadLayersModel('./assets/model.json');
//    console.log(this.model.summary());

    if (this.device.platform == "browser"){
      this.loadImage(imgEntry.path); 
    }else {
      // Convert image
      this.getFileContentAsBase64(imgEntry.filePath,function(base64Image){
      //window.open(base64Image);
      this.presentToast(base64Image);
      this.loadImage(base64Image);  
      // Then you'll be able to handle the myimage.png file as base64
      });
    }
    this.callbackImageLoaded(this.workImg);
//    console.log(this.workImg);
    this.outputImg = new MarvinImage();
    this.create(this.outputImg,this.workImg.canvas.width,this.workImg.canvas.height);
    Marvin.grayScale(this.workImg, this.outputImg);
    this.outputImg.canvas.getContext("2d").putImageData(this.outputImg.imageData, 0,0);
    this.workImg = this.outputImg;
    this.outputImg = new MarvinImage();
    this.create(this.outputImg,28,28);
    this.Scale(this.workImg,this.outputImg,28,28)
    this.outputImg.canvas.getContext("2d").putImageData(this.outputImg.imageData, 0,0);
//    console.log(this.outputImg);
    
    let imageData = this.outputImg.ctx.getImageData(0, 0, 28, 28);
    // Convert the canvas pixels to 
    let img1 = tf.browser.fromPixels(imageData, 1);
    img1 = img1.reshape([1, 28, 28, 1]);
    img1 = tf.cast(img1, 'float32');

    const output = this.model.predict(img1) as any;
    // Make and format the predications
//    console.log(output);
    const outputArray = Array.from(output.dataSync());
//    console.log(outputArray);
//    console.log(outputArray.indexOf(1));
    this.presentToast('The image is the letter: ' + String.fromCharCode(outputArray.indexOf(1)+65));
    
    let img = this.outputImg.canvas.toDataURL('image/jpeg', 1.0);
    
    if (this.device.platform == "browser"){
        this.copyFileToLocalDirBrowser(img, outputArray.indexOf(1) + "-" + String.fromCharCode(outputArray.indexOf(1)+65) + "-" + this.createFileName());
    } else {
        var currentName = imgEntry.filePath.substr(imgEntry.filePath.lastIndexOf('/') + 1);
	var correctPath = imgEntry.filePath.substr(0, imgEntry.filePath.lastIndexOf('/') + 1);
	this.copyFileToLocalDir(correctPath, currentName, outputArray.indexOf(1)+"-"+String.fromCharCode(outputArray.indexOf(1)+65) + "-" + this.createFileName());
	this.file.resolveLocalFilesystemUrl(imgEntry.filePath)
	    .then(entry => {
		( < FileEntry > entry).file(file => this.readFile(file))
	    })
	    .catch(err => {
		this.presentToast('Error while reading file.');
	    });
    }
    //loading.dismiss();


  }
  
  readFile(file: any) {
    const reader = new FileReader();
    reader.onload = () => {
        const formData = new FormData();
        const imgBlob = new Blob([reader.result], {
            type: file.type
        });
        formData.append('file', imgBlob, file.name);
//        this.uploadImageData(formData);
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

  Scale(imgin,imgout,newWidth,newHeight){
    let width = imgin.getWidth();
    let height = imgin.getHeight();

    if(imgout.getWidth() != newWidth || imgout.getHeight() != newHeight){
      imgout.setDimension(newWidth, newHeight);
    }

    var x_ratio = Math.floor((width<<16)/newWidth) ;
    var y_ratio = Math.floor((height<<16)/newHeight) ;
    var x2, y2 ;
    for (var i=0;i<newHeight;i++) {
      for (var j=0;j<newWidth;j++) {
        x2 = Math.floor((j*x_ratio)>>16) ;
        y2 = Math.floor((i*y_ratio)>>16) ;
        imgout.setIntColor(j,i, imgin.getAlphaComponent(x2,y2), imgin.getIntColor(x2,y2));
      }
    }
  }
  
  create(marvinImage, width, height){
    marvinImage.canvas = document.createElement('canvas');
    marvinImage.canvas.width = width;
    marvinImage.canvas.height = height;
    marvinImage.ctx = marvinImage.canvas.getContext("2d");
    marvinImage.imageData = marvinImage.ctx.getImageData(0, 0, width, height);
    marvinImage.width = width;
    marvinImage.height = height;
  }
  
  getFileContentAsBase64(path,callback){
    this.file.resolveLocalFilesystemUrl(path)
      .then(entry => {
        ( < FileEntry > entry).file(file => {return this.readFileAsDataURL(file)})
      })
      .catch(err => {
        this.presentToast('Error while reading file.');
      });

  }

  readFileAsDataURL(file: any) {
    const reader = new FileReader();
    reader.onload = () => {
	return reader.result;
    };
    reader.readAsDataURL(file);
  }

}
