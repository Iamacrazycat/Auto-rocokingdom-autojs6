import struct
import sys

def patch_version_code(axml_path, new_version_code):
    with open(axml_path, 'rb') as f:
        data = bytearray(f.read())
    
    # Simple heuristic: find the "versionCode" string, but that's hard because of string pool.
    # Instead, we look for the Res_value signature. But wait! There could be other INT_DEC attributes with value 4.
    # Let's write a real AXML parser!
    
    # AXML Header
    if data[0:4] != b'\x03\x00\x08\x00':
        raise Exception("Not a valid AXML file")
        
    file_size = struct.unpack('<I', data[4:8])[0]
    
    # Parse chunks
    offset = 8
    string_pool = []
    resource_ids = []
    
    while offset < len(data):
        chunk_type, chunk_header_size, chunk_size = struct.unpack('<HHI', data[offset:offset+8])
        
        if chunk_type == 0x0001: # RES_STRING_POOL_TYPE
            pass
        elif chunk_type == 0x0180: # RES_XML_RESOURCE_MAP_TYPE
            # This array maps string index to resource ID!
            num_res_ids = (chunk_size - chunk_header_size) // 4
            for i in range(num_res_ids):
                res_id = struct.unpack('<I', data[offset + chunk_header_size + i*4 : offset + chunk_header_size + i*4 + 4])[0]
                resource_ids.append(res_id)
        elif chunk_type == 0x0102: # RES_XML_START_ELEMENT_TYPE
            # struct ResXMLTree_node (16 bytes)
            # struct ResXMLTree_endElementExt (20 bytes)
            # But it's actually:
            # node_header (16 bytes)
            # ns (4)
            # name (4)
            # attributeStart (2)
            # attributeSize (2) -> usually 20
            # attributeCount (2)
            # idIndex (2)
            # classIndex (2)
            # styleIndex (2)
            # attributes[attributeCount]
            
            ext_offset = offset + chunk_header_size
            ns, name, attr_start, attr_size, attr_count, id_idx, cls_idx, style_idx = struct.unpack('<IIHHHHHH', data[ext_offset:ext_offset+20])
            
            attr_offset = ext_offset + attr_start
            for i in range(attr_count):
                curr_attr_offset = attr_offset + i * attr_size
                attr_ns, attr_name, attr_raw, attr_val_size, attr_val_res0, attr_val_type = struct.unpack('<IIIHBB', data[curr_attr_offset:curr_attr_offset+16])
                # attr_name is an index into the string pool.
                # If there's a resource map, attr_name is ALSO an index into the resource map!
                if attr_name < len(resource_ids):
                    res_id = resource_ids[attr_name]
                    if res_id == 0x0101021b: # android:versionCode
                        print(f"Found versionCode attribute at offset {curr_attr_offset}! Original data: {struct.unpack('<I', data[curr_attr_offset+16:curr_attr_offset+20])[0]}")
                        # Overwrite!
                        struct.pack_into('<I', data, curr_attr_offset+16, new_version_code)
                        print(f"Patched versionCode to {new_version_code}")
                        
                        with open(axml_path, 'wb') as out:
                            out.write(data)
                        return
                        
        offset += chunk_size
        
    raise Exception("Could not find versionCode attribute!")

if __name__ == '__main__':
    patch_version_code(sys.argv[1], int(sys.argv[2]))
