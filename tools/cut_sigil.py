# Cut the neon sigil from its black field into transparent PNGs at every size the site uses.
# Usage (needs Pillow + numpy): python tools/cut_sigil.py <black-background source> assets/images/
# Glow is "unscreened" (alpha from brightness) so it stays translucent blue; only the navy fill inside the
# head stays solid, black gaps go clear; aqua hues are nudged toward blue; a soft blue halo and margin are added.
import sys; from PIL import Image, ImageFilter; import numpy as np
src, out = sys.argv[1], sys.argv[2]
HUE_SHIFT, PAD, HALO_RGB, HALO_A = 16, 0.05, (60, 150, 230), 0.30
a=np.array(Image.open(src).convert('RGB')).astype(float); mx=a.max(-1); h0,w0=mx.shape

def reach(passable):  # border-connected region through passable pixels
    r=np.zeros_like(passable); r[0]=passable[0]; r[-1]=passable[-1]; r[:,0]=passable[:,0]; r[:,-1]=passable[:,-1]
    while True:
        g=r.copy(); g[1:]|=r[:-1]; g[:-1]|=r[1:]; g[:,1:]|=r[:,:-1]; g[:,:-1]|=r[:,1:]; g&=passable
        if (g==r).all(): return r
        r=g
outside=reach(mx<50)
fill=~outside & (mx>15)              # navy face/antler fill enclosed by the lines; pure-black gaps excluded
assert 0.1 < fill.mean() < 0.5, fill.mean()

alpha=mx/255.0                        # unscreen: the black field becomes transparency, glow keeps its colour
rgb=np.clip(a/np.maximum(alpha,1e-6)[...,None],0,255)
alpha=np.where(fill,1.0,alpha); rgb=np.where(fill[...,None],a,rgb)

# nudge aqua/azure toward blue (hues ~165-215 deg), leaving gold and magenta alone
hsv=np.array(Image.fromarray(rgb.round().astype(np.uint8)).convert('HSV')).astype(float)
hd=hsv[...,0]*360/255; wgt=np.clip(1-np.abs(hd-190)/30,0,1)
hsv[...,0]=((hd+HUE_SHIFT*wgt)%360)*255/360
rgb=np.array(Image.fromarray(hsv.round().astype(np.uint8),'HSV').convert('RGB')).astype(float)

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
for S_,n in [(48,'favicon-48.png'),(192,'favicon-192.png'),(180,'apple-touch-icon.png')]:
    s=im.copy(); s.thumbnail((S_,S_),Image.LANCZOS); c=Image.new('RGBA',(S_,S_),(0,0,0,0)); c.paste(s,((S_-s.width)//2,(S_-s.height)//2)); c.save(out+n,optimize=True)
print('fill',fill.mean().round(3),'size',w,h,'hero height at 1100:',round(h*1100/w))
