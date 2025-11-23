with open('frontend/src/components/views/DealsView.tsx','r',encoding='utf-8') as f:
    lines=f.readlines()
for i in range(900, 1210):
    print(f"{i+1}: {lines[i].rstrip()}")
