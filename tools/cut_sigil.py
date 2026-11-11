# Cut the neon sigil from its black field into transparent PNGs at every size the site uses.
# Usage (needs Pillow, numpy, scipy): python tools/cut_sigil.py <black-background source> assets/images/
# Glow is "unscreened" (alpha from brightness) so it stays translucent blue; only the navy fill inside the
# head stays solid, black gaps go clear; aqua hues are nudged toward blue; a soft blue halo and margin are added.
import sys; from PIL import Image, ImageFilter; import numpy as np; from scipy import ndimage as nd
src, out = sys.argv[1], sys.argv[2]
HUE_SHIFT, PAD, HALO_RGB, HALO_A = 16, 0.05, (60, 150, 230), 0.30
a=np.array(Image.open(src).convert('RGB')).astype(float); mx=a.max(-1); h0,w0=mx.shape

# Enclosed dark regions: keep solid only those that are mostly the artwork's deep navy fill (~0,1,37);
# dark wedges between antlers and ears, and stray gaps between horns, go clear like the outside.
low=mx<50; lab,n=nd.label(low); idx=np.arange(1,n+1)
navy=(a[...,2]>=30)&(a[...,2]<=60)&(a[...,0]<15)&(a[...,1]<20)
border=np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]])
keep=(nd.mean(navy,lab,idx)>0.5)&~np.isin(idx,border)
fill=np.r_[False,keep][lab]
fill=nd.binary_dilation(fill,iterations=2)&(mx<80)    # cover the soft seam between fill and its line
assert 0.05 < fill.mean() < 0.4, fill.mean()

alpha=np.clip(mx/140.0,0,1)          # unscreen: black field -> transparency; strokes above ~140 fully opaque
rgb=np.clip(a/np.maximum(alpha,1e-6)[...,None],0,255)
navy_rgb=np.array([2,4,40.])
fa=np.where((mx<=12)[...,None],navy_rgb,a)       # no pure black inside the fill
alpha=np.where(fill,1.0,alpha); rgb=np.where(fill[...,None],fa,rgb)

# nudge aqua/azure toward blue (hues ~165-215 deg), leaving gold and magenta alone
hsv=np.array(Image.fromarray(rgb.round().astype(np.uint8)).convert('HSV')).astype(float)
hd=hsv[...,0]*360/255; v=hsv[...,2]/255
wgt=np.clip(1-np.abs(hd-190)/30,0,1)*np.clip((0.85-v)/0.25,0,1)   # bright cores keep their cyan-white
hsv[...,0]=((hd+HUE_SHIFT*wgt)%360)*255/360
rgb=np.array(Image.fromarray(hsv.round().astype(np.uint8),'HSV').convert('RGB')).astype(float)
lift=np.clip((v-0.78)/0.22,0,1)[...,None]*0.45   # push the hottest line cores toward white, like the earlier sigil
rgb=rgb+(255-rgb)*lift

art=Image.fromarray(np.dstack([rgb,alpha*255]).round().astype(np.uint8),'RGBA')
p=int(w0*PAD); W,H=w0+2*p,h0+2*p
canvas=Image.new('RGBA',(W,H),(0,0,0,0)); canvas.paste(art,(p,p))
m=Image.new('L',(W,H),0); m.paste(Image.fromarray((np.clip(mx/120,0,1)*255).astype(np.uint8)),(p,p))
halo_a=np.array(m.filter(ImageFilter.GaussianBlur(w0*0.008))).astype(float)/255
halo_a=np.clip(halo_a*1.6,0,1)*HALO_A
halo=Image.fromarray(np.dstack([np.broadcast_to(np.array(HALO_RGB,float),(H,W,3)),halo_a*255]).round().astype(np.uint8),'RGBA')
im=Image.alpha_composite(halo,canvas); w,h=im.size

q=lambda x: x.quantize(256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.FLOYDSTEINBERG)
for Wd,n in [(1100,'sigil.png'),(900,'sigil-900.png'),(720,'sigil-720.png'),(240,'sigil-small.png')]:
    q(im.resize((Wd,round(h*Wd/w)),Image.LANCZOS)).save(out+n,optimize=True)
# Icons sit on light or dark tab bars, so back the silhouette with navy to keep it solid there.
sil=nd.binary_fill_holes(nd.binary_closing(np.array(im)[...,3]>90,iterations=3))
under=Image.fromarray(np.dstack([np.broadcast_to(navy_rgb,(h,w,3)),sil*255.]).astype(np.uint8),'RGBA')
icon=Image.alpha_composite(under,im)
for S_,n in [(48,'favicon-48.png'),(192,'favicon-192.png'),(180,'apple-touch-icon.png')]:
    s=icon.copy(); s.thumbnail((S_,S_),Image.LANCZOS); c=Image.new('RGBA',(S_,S_),(0,0,0,0)); c.paste(s,((S_-s.width)//2,(S_-s.height)//2)); c.save(out+n,optimize=True)
print('fill',fill.mean().round(3),'size',w,h,'hero height at 1100:',round(h*1100/w))
