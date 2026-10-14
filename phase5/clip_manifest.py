"""Pinned public ONNX conversion of CLIP; metadata checked 14 October 2026."""
REPOSITORY = 'Xenova/clip-vit-base-patch32'
REVISION = 'd15189d7028b43f1d3e65039190477f6af591c2a'
# Small files use their Git blob digest; LFS files use the published SHA-256.
FILES = {
    'onnx/text_model_quantized.onnx': (64504507, 'sha256', '73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a'),
    'onnx/vision_model_quantized.onnx': (89117001, 'sha256', '583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299'),
    'tokenizer.json': (2224119, 'git-blob', 'bc1f77d20440541dd073ebae6f6c401087c7d34e'),
    'preprocessor_config.json': (520, 'git-blob', 'e0675735fd0052745f2f7b7291e4aa7859389998'),
    'tokenizer_config.json': (775, 'git-blob', 'c9b2a711cbdd039529fa5a66f1965e13eb14451d'),
    'config.json': (4524, 'git-blob', 'e79bad158b04c235740f9b2ec320b17f4030f7a5'),
}


def verify_file(path, specification):
    import hashlib
    size, algorithm, expected = specification
    if path.is_symlink() or not path.is_file() or path.stat().st_size != size:
        raise ValueError('Model file missing or incorrect size: ' + path.name)
    digest = hashlib.sha256() if algorithm == 'sha256' else hashlib.sha1()
    if algorithm == 'git-blob':
        digest.update(f'blob {size}\0'.encode())
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise ValueError('Model checksum mismatch: ' + path.name)
