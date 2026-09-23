# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Read Mozilla's normal and optimized omni archives for local builders."""
import io
import struct
import zipfile

def read_omni(path):
    data=path.read_bytes()
    try:return zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        # Mozilla optimized jars put their directory first. Preserve local-file
        # offsets and append a standard central directory for Python's reader.
        end=data.rfind(b'PK\x05\x06')
        if end<0:raise ValueError('Missing ZIP end record')
        record=list(struct.unpack('<4s4H2IH',data[end:end+22]))
        size,start=record[5:7]
        if data[start:start+4]!=b'PK\x01\x02':raise ValueError('Invalid central directory')
        record[6]=end
        return zipfile.ZipFile(io.BytesIO(data[:end]+data[start:start+size]+struct.pack('<4s4H2IH',*record)))

