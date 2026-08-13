from PIL import Image

def tint_image(input_path, output_path, target_hex):
    target_hex = target_hex.lstrip('#')
    tr, tg, tb = tuple(int(target_hex[i:i+2], 16) for i in (0, 2, 4))
    
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        r, g, b, a = item
        if a > 0:
            new_data.append((tr, tg, tb, a))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

print("Tinting logos...")
tint_image("assets/logo-transparent-light.png", "assets/logo-gold.png", "#C5963A")
tint_image("assets/crown-light.png", "assets/crown-gold.png", "#C5963A")
print("Done!")
